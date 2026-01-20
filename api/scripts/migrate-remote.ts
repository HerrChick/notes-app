import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { db } from '../src/db/client'

const here = path.dirname(fileURLToPath(import.meta.url))

// Always load env from the repo root, not from ./api.
const repoRootEnvPath = path.resolve(here, '../../.env')
dotenv.config({ path: repoRootEnvPath })

// Support common Turso naming; normalize to the names used by this repo.
if (!process.env.DATABASE_URL && process.env.TURSO_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TURSO_DATABASE_URL
}
if (!process.env.DATABASE_AUTH_TOKEN && process.env.TURSO_AUTH_TOKEN) {
  process.env.DATABASE_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN
}

function requireEnv(name: string) {
  const v = process.env[name]
  if (!v) {
    throw new Error(
      `Missing required env var ${name}. Expected it in ${repoRootEnvPath} (or exported in your shell).` +
        ` (Also supported: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN.)`,
    )
  }
  return v
}

async function main() {
  const url = requireEnv('DATABASE_URL')
  // Token is required for most Turso/libSQL deployments; allow empty for local file DBs.
  if (!url.startsWith('file:')) {
    requireEnv('DATABASE_AUTH_TOKEN')
  }

  const migrationsFolder = path.resolve(here, '../drizzle')
  await migrate(db(), { migrationsFolder })

  // eslint-disable-next-line no-console
  console.log(`Migrations applied from ${migrationsFolder}`)
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})

