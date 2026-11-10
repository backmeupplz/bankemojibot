# Bank

[@bankemojibot](https://t.me/bankemojibot): a tiny currency for Telegram, one balance across every chat. Website: [bankemojibot.borodutch.com](https://bankemojibot.borodutch.com).

Everyone starts with 100 coins. React to someone's message with a coin and that many coins move from you to them:

🍌 1 · 🍓 5 · 🍾 10 · 🏆 25

Gifts are final: removing the reaction doesn't take the coins back, and adding it again doesn't pay twice. Add the bot to a group as an admin (no rights needed): Telegram only sends reactions to admin bots. The bot messages people when they get coins (once they've started it) and when a reaction gift bounces for lack of coins.

Commands: `/balance`, `/top` (this group's people in a group, everyone in DM), reply `/give 10`, `/help`.

## Run

```sh
bun install
TOKEN=... bun bot.ts   # DATA_DIR (default .) holds bank.sqlite
bun test
```

## Website

`docs/` is the static site, served by GitHub Pages (main:/docs) behind Cloudflare. The share image `docs/og.png` is rendered from `og/og.html`:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=1200,630 --screenshot=$PWD/docs/og.png "file://$PWD/og/og.html"
```

Bump `og.png?v=N` in `docs/index.html` after re-rendering. `docs/logo.svg` is also the bot's profile picture (render it at 1024×1024).

## Deploy

Deployed on Tugport (`bots.bankemojibot`) with a `/data` volume and `HANDOVER_LOCK` for zero-downtime deploys.
