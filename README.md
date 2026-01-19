## Retrowave Note Taking App

Stream-of-thought daily notes in Markdown, with automatic extraction of:
- **Todos** from `- [ ]` / `- [x]` task list items (stable IDs via hidden `<!--todo:UUID-->` markers)
- **Topics** from `### TopicName` sections, where `---` ends topic attribution so unheaded text stays uncategorized

### Repo layout
- `web/`: Vite + React + Tailwind (dark + purple retrowave theme)
- `api/`: API + DB (Drizzle ORM + libSQL client) and migrations
- `netlify/functions/api.ts`: Netlify function wrapper that forwards `/api/*` requests to the core handler

## Local development

### Prereqs
- Node.js 20+ (works on Node 25+)

### Install

```bash
npm install
```

### Configure env (local)

Create a root `.env` by copying `env.template`:

```bash
cp env.template .env
```

### Run

```bash
npm run dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:8787/api/health`

On first run, visit the app and use the **Create account** screen (single-user).

## Database migrations

- **Local dev** (file DB): migrations auto-run on API startup.
- **Hosted DB (Turso/libSQL)**: run migrations via Drizzle Kit (recommended in CI/CD).

Generate migration files:

```bash
npm --workspace api run db:generate
```

Push schema to Turso (requires env vars set):

```bash
DATABASE_URL=... DATABASE_AUTH_TOKEN=... npm --workspace api run db:push:turso
```

## Deploy

### Netlify (recommended for this repo structure)

This repo is currently **Netlify-first** (serverless wrapper is already in `netlify/functions`).

1. Create a Turso database (or any libSQL-compatible hosted SQLite) and get:
   - `DATABASE_URL`
   - `DATABASE_AUTH_TOKEN`
2. Set Netlify build settings (or use `netlify.toml` in this repo):
   - **Build command**: `npm run build`
   - **Publish directory**: `web/dist`
   - **Functions directory**: `netlify/functions`
3. Add Netlify environment variables:
   - `DATABASE_URL`
   - `DATABASE_AUTH_TOKEN`
   - `SESSION_SECRET` (long random string)
4. Ensure redirects are set so `/api/*` routes to the function and SPA routes fall back to `index.html`.

### Vercel

Vercel prefers serverless functions under a root `api/` directory. This repo already uses `api/` for backend source, so deploying serverless endpoints on Vercel would require a small restructure (move backend source out of `api/` and add Vercel function entrypoints).

## Production checklist
- Set `SESSION_SECRET` to a long random value
- Use HTTPS-only cookies (`Secure` is enabled automatically in production)
- Use a hosted libSQL/Turso database (do not rely on local SQLite files on serverless)
- Add backups for your DB (Turso supports snapshots/replication options depending on plan)
