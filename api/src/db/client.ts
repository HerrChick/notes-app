import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'

let _db: ReturnType<typeof drizzle> | null = null

export function db() {
  if (_db) return _db

  // Local dev defaults to a file-backed libSQL DB.
  const url = process.env.DATABASE_URL ?? 'file:./local.db'
  const authToken = process.env.DATABASE_AUTH_TOKEN

  const client = createClient({
    url,
    authToken,
  })

  _db = drizzle(client)
  return _db
}

