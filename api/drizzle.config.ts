import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  // Migrations are generated from schema snapshots and do not require a live DB.
  // We keep this config SQLite-focused so `drizzle-kit generate` works without env.
  dialect: 'sqlite',
  strict: true,
  verbose: true,
})

