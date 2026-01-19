import { migrate } from 'drizzle-orm/libsql/migrator'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db } from './client'

let didMigrate = false

export async function ensureMigrated() {
  if (didMigrate) return

  // For hosted DBs (e.g. Turso/libSQL on Netlify/Vercel), run migrations in CI/CD
  // using drizzle-kit. Serverless bundlers may not include the migrations folder
  // reliably at runtime. For local dev (file: URLs), we auto-migrate.
  const url = process.env.DATABASE_URL ?? 'file:./local.db'
  const shouldAutoMigrate = url.startsWith('file:') || process.env.RUN_MIGRATIONS === '1'
  if (!shouldAutoMigrate) {
    didMigrate = true
    return
  }

  const here = path.dirname(fileURLToPath(import.meta.url))
  const migrationsFolder = path.resolve(here, '../../drizzle')

  await migrate(db(), { migrationsFolder })
  didMigrate = true
}

