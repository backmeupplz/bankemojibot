import { Bot, type Context } from 'grammy'
import type { User } from 'grammy/types'
import { COINS, START, openBank } from './bank'
import { pollWithHandover } from './handover'

const bank = openBank(`${process.env.DATA_DIR ?? '.'}/bank.sqlite`)
const bot = new Bot(process.env.TOKEN!)

const name = (u: User) => [u.first_name, u.last_name].filter(Boolean).join(' ')
const coins = Object.entries(COINS).map(([e, v]) => `${e} ${v}`).join(' · ')
const link = (chat: number, id: number) =>
  String(chat).startsWith('-100') ? `\nhttps://t.me/c/${String(chat).slice(4)}/${id}` : ''
const dm = (id: number, text: string) =>
  bot.api.sendMessage(id, text, { link_preview_options: { is_disabled: true } }).catch(() => {})
const isGroup = (ctx: Context) => ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup'

const help = (id: number) => `Bank is a tiny currency for Telegram, one balance across every chat.

Everyone starts with ${START} coins. React to someone's message with a coin and it moves from you to them:
${coins}

Gifts are final: taking the reaction off doesn't take the coins back. Add me to a group as an admin (no rights needed) so I can see reactions there.

You have ${bank.balance(id)} coins.

/balance · /top · reply /give 10 to send any amount`

// Remember who wrote what, so a reaction knows whom to pay
bot.use((ctx, next) => {
  const from = ctx.from
  if (from && !from.is_bot) bank.seen(from.id, name(from))
  const m = ctx.message
  if (m && from && !from.is_bot && !m.sender_chat && isGroup(ctx)) bank.remember(m.chat.id, m.message_id, from.id)
  return next()
})

bot.command(['start', 'help'], (ctx) => ctx.reply(help(ctx.from!.id)))
bot.command('balance', (ctx) => ctx.reply(`${name(ctx.from!)}, you have ${bank.balance(ctx.from!.id)} coins.`))
bot.command('top', (ctx) => {
  const rows = bank.top(isGroup(ctx) ? ctx.chat.id : undefined)
  ctx.reply(rows.length ? rows.map((r, i) => `${i + 1}. ${r.name || '?'}: ${r.balance}`).join('\n') : 'Nobody has any yet.')
})
bot.command('give', async (ctx) => {
  const to = ctx.message?.reply_to_message?.from
  const amount = Number(ctx.match.trim())
  if (!to || to.is_bot || !Number.isSafeInteger(amount) || amount <= 0)
    return ctx.reply('Reply to someone\'s message with /give 10 to send them 10 coins.')
  bank.seen(to.id, name(to))
  const r = bank.transfer(ctx.from!.id, to.id, amount)
  if (r === 'self') return ctx.reply('That\'s you.')
  if (r === 'broke') return ctx.reply(`You only have ${bank.balance(ctx.from!.id)} coins.`)
  await ctx.reply(`${name(ctx.from!)} gave ${name(to)} ${amount} coins.`)
})

bot.on('message_reaction', async (ctx) => {
  const r = ctx.messageReaction
  const giver = r.user
  if (!giver || giver.is_bot) return // anonymous admins and channels can't pay
  const author = bank.author(r.chat.id, r.message_id)
  if (!author) return
  for (const coin of ctx.reactions().emojiAdded) {
    const amount = COINS[coin]
    if (!amount) continue
    const res = bank.transfer(giver.id, author, amount, [r.chat.id, r.message_id, coin])
    const where = `in ${'title' in r.chat ? r.chat.title : 'a chat'}${link(r.chat.id, r.message_id)}`
    if (res === 'ok')
      await dm(author, `${coin} +${amount} from ${name(giver)} ${where}\nYou have ${bank.balance(author)} coins.`)
    else if (res === 'broke')
      await dm(giver.id, `Not enough coins for ${coin} (${amount}) ${where}\nYou have ${bank.balance(giver.id)}.`)
  }
})

bot.on('my_chat_member', (ctx) => {
  if (!isGroup(ctx)) return
  const s = ctx.myChatMember.new_chat_member.status
  if (s === 'member')
    return ctx.reply('Hi! Make me an admin (no rights needed) so I can see reactions. Telegram only shows them to admins.')
  if (s === 'administrator' && ctx.myChatMember.old_chat_member.status !== 'administrator')
    return ctx.reply(`Ready. React to a message with a coin to give it to its author:\n${coins}\n\nEveryone starts with ${START}. /help`)
})

bot.catch((e) => console.error(e.error))

setInterval(bank.prune, 3600_000)
await bot.api.setMyCommands([
  { command: 'balance', description: 'Your coins' },
  { command: 'top', description: 'Who has the most' },
  { command: 'give', description: 'Reply to send coins: /give 10' },
  { command: 'help', description: 'How Bank works' },
])
pollWithHandover(
  () =>
    bot.start({
      allowed_updates: ['message', 'message_reaction', 'my_chat_member'],
      onStart: (me) => console.log(`@${me.username} up`),
    }),
  () => bot.stop(),
)
