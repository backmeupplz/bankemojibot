import { Database } from 'bun:sqlite'

// The coins: free (non-premium) reactions, each worth this many
export const COINS: Record<string, number> = { '🍌': 1, '🍓': 5, '🍾': 10, '🏆': 25 }
export const START = 100

export type Gift = 'ok' | 'self' | 'broke' | 'again'

export function openBank(path: string) {
  const db = new Database(path, { create: true })
  db.run('PRAGMA journal_mode = WAL')
  db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, balance INTEGER NOT NULL)')
  // Telegram's reaction updates don't say who wrote the message, so the bot remembers authors
  db.run(`CREATE TABLE IF NOT EXISTS messages (chat INTEGER, id INTEGER, author INTEGER NOT NULL, date INTEGER NOT NULL,
    PRIMARY KEY (chat, id))`)
  // One payment per giver, message and coin: taking a reaction off and back on doesn't pay twice
  db.run(`CREATE TABLE IF NOT EXISTS gifts (chat INTEGER, id INTEGER, giver INTEGER, coin TEXT,
    PRIMARY KEY (chat, id, giver, coin))`)

  const upsertUser = db.query(
    'INSERT INTO users VALUES (?1, ?2, ?3) ON CONFLICT (id) DO UPDATE SET name = ?2',
  )
  const ensure = db.query('INSERT OR IGNORE INTO users VALUES (?, ?, ?)')
  const balanceQ = db.query<{ balance: number }, [number]>('SELECT balance FROM users WHERE id = ?')
  const move = db.query('UPDATE users SET balance = balance + ? WHERE id = ?')
  const markGift = db.query('INSERT OR IGNORE INTO gifts VALUES (?, ?, ?, ?)')
  const authorQ = db.query<{ author: number }, [number, number]>(
    'SELECT author FROM messages WHERE chat = ? AND id = ?',
  )

  const balance = (id: number) => balanceQ.get(id)?.balance ?? START

  // Moves coins from one person to another; `gift` (chat, message, coin) makes it once-only
  const transfer = db.transaction(
    (from: number, to: number, amount: number, gift?: [number, number, string]): Gift => {
      if (from === to) return 'self'
      ensure.run(from, '', START)
      ensure.run(to, '', START)
      if (balance(from) < amount) return 'broke'
      if (gift && !markGift.run(gift[0], gift[1], from, gift[2]).changes) return 'again'
      move.run(-amount, from)
      move.run(amount, to)
      return 'ok'
    },
  )

  return {
    db,
    balance,
    transfer,
    // Called for everyone the bot sees, so new people get their starting coins and names stay fresh
    seen: (id: number, name: string) => upsertUser.run(id, name, START),
    remember: (chat: number, id: number, author: number) =>
      db.query('INSERT OR REPLACE INTO messages VALUES (?, ?, ?, ?)').run(chat, id, author, Date.now()),
    author: (chat: number, id: number) => authorQ.get(chat, id)?.author,
    // ponytail: authors are kept 30 days, so reactions on older messages don't pay
    prune: () => db.query('DELETE FROM messages WHERE date < ?').run(Date.now() - 30 * 86400_000),
    // In a group: people who wrote there lately; elsewhere: everyone
    top: (chat?: number) =>
      (chat
        ? db.query<{ name: string; balance: number }, [number]>(
            `SELECT name, balance FROM users WHERE id IN (SELECT author FROM messages WHERE chat = ?)
             ORDER BY balance DESC LIMIT 10`,
          ).all(chat)
        : db.query<{ name: string; balance: number }, []>(
            'SELECT name, balance FROM users ORDER BY balance DESC LIMIT 10',
          ).all()),
  }
}

export type Bank = ReturnType<typeof openBank>
