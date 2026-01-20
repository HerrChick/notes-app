import { z } from 'zod'
import crypto from 'node:crypto'
import { and, desc, eq, isNull, notInArray } from 'drizzle-orm'
import { db } from './db/client'
import { ensureMigrated } from './db/migrate'
import { dailyNotes, todoNotes, todos, topicEntries, topics, users } from './db/schema'
import { hashPassword, verifyPassword } from './auth/password'
import { clearSessionCookie, createSessionCookie, getAuthenticatedUser, requireUser } from './auth/session'
import { indexDailyMarkdown } from './notes/indexDaily'
import { stabilizeTodoMarkers } from './notes/todoMarkers'
import { toggleTodoCheckboxInMarkdown } from './notes/toggleTodoInMarkdown'

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(data, null, 2), { ...init, headers })
}

async function readJson<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  const raw = await req.text()
  const parsed = raw ? JSON.parse(raw) : null
  return schema.parse(parsed)
}

const HealthResponse = z.object({
  ok: z.literal(true),
  time: z.string(),
  env: z.object({
    hasDatabaseUrl: z.boolean(),
    hasDatabaseAuthToken: z.boolean(),
    hasSessionSecret: z.boolean(),
  }),
})

export async function handleApiRequest(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url)
    const { pathname } = url

    // Health check (used by local dev + hosting verification).
    if (req.method === 'GET' && pathname === '/api/health') {
      const payload = HealthResponse.parse({
        ok: true,
        time: new Date().toISOString(),
        env: {
          hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
          hasDatabaseAuthToken: Boolean(process.env.DATABASE_AUTH_TOKEN),
          hasSessionSecret: Boolean(process.env.SESSION_SECRET),
        },
      })
      return json(payload)
    }

    // Auth routes
    if (pathname === '/api/auth/status' && req.method === 'GET') {
      await ensureMigrated()
      const existing = await db().select({ id: users.id, username: users.username }).from(users).limit(1)
      const needsSetup = existing.length === 0
      if (needsSetup) return json({ authenticated: false, needsSetup: true })

      const user = await getAuthenticatedUser(req)
      if (!user) return json({ authenticated: false, needsSetup: false })
      return json({ authenticated: true, needsSetup: false, username: user.username })
    }

    if (pathname === '/api/auth/setup' && req.method === 'POST') {
      await ensureMigrated()
      const existing = await db().select({ id: users.id }).from(users).limit(1)
      if (existing.length > 0) {
        return json({ ok: false, error: 'Already set up' }, { status: 409 })
      }

      const body = await readJson(
        req,
        z.object({
          username: z.string().min(3).max(64),
          password: z.string().min(8).max(256),
        }),
      )

      const now = new Date()
      const passwordHash = await hashPassword(body.password)
      const inserted = await db()
        .insert(users)
        .values({ username: body.username, passwordHash, createdAt: now })
        .returning({ id: users.id })

      const userId = inserted[0]?.id
      if (!userId) return json({ ok: false, error: 'Failed to create user' }, { status: 500 })

      const { setCookie } = await createSessionCookie(userId)
      return json(
        { ok: true },
        {
          status: 201,
          headers: {
            'set-cookie': setCookie,
          },
        },
      )
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      await ensureMigrated()
      const body = await readJson(
        req,
        z.object({
          username: z.string().min(1),
          password: z.string().min(1),
        }),
      )

      const found = await db()
        .select({ id: users.id, passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.username, body.username))
        .limit(1)

      const user = found[0]
      if (!user) return json({ ok: false, error: 'Invalid credentials' }, { status: 401 })

      const ok = await verifyPassword(body.password, user.passwordHash)
      if (!ok) return json({ ok: false, error: 'Invalid credentials' }, { status: 401 })

      const { setCookie } = await createSessionCookie(user.id)
      return json(
        { ok: true },
        {
          headers: {
            'set-cookie': setCookie,
          },
        },
      )
    }

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      return json(
        { ok: true },
        {
          headers: {
            'set-cookie': clearSessionCookie(),
          },
        },
      )
    }

    // Daily notes
    {
      const m = pathname.match(/^\/api\/daily\/(\d{4}-\d{2}-\d{2})$/)
      if (m) {
        const auth = await requireUser(req)
        if (!auth.ok) return auth.response

        const date = m[1]
        await ensureMigrated()

        if (req.method === 'GET') {
          const found = await db()
            .select({ date: dailyNotes.date, markdown: dailyNotes.markdown })
            .from(dailyNotes)
            .where(eq(dailyNotes.date, date))
            .limit(1)
          return json({ date, markdown: found[0]?.markdown ?? '' })
        }

        if (req.method === 'PUT') {
          const body = await readJson(req, z.object({ markdown: z.string() }))
          const now = new Date()
          let responseMarkdown = body.markdown

          await db().transaction(async (tx) => {
            // Stabilize todo markers against the previous saved markdown so that
            // editing/copying marker IDs doesn't create "new" todos.
            const existing = await tx
              .select({ markdown: dailyNotes.markdown })
              .from(dailyNotes)
              .where(eq(dailyNotes.date, date))
              .limit(1)

            const previousMarkdown = existing[0]?.markdown ?? ''
            const stabilized = stabilizeTodoMarkers({ previousMarkdown, nextMarkdown: body.markdown }).markdown
            const parsed = indexDailyMarkdown(stabilized)
            responseMarkdown = parsed.markdown

            // Save note
            await tx
              .insert(dailyNotes)
              .values({
                date,
                markdown: responseMarkdown,
                createdAt: now,
                updatedAt: now,
              })
              .onConflictDoUpdate({
                target: dailyNotes.date,
                set: {
                  markdown: responseMarkdown,
                  updatedAt: now,
                },
              })

            // Upsert todos (stable via <!--todo:UUID--> markers)
            const incomingIds = parsed.todos.map((t) => t.id)

            if (incomingIds.length === 0) {
              await tx
                .update(todos)
                .set({ deletedAt: now, updatedAt: now })
                .where(and(eq(todos.dailyDate, date), isNull(todos.deletedAt)))
            } else {
              await tx
                .update(todos)
                .set({ deletedAt: now, updatedAt: now })
                .where(and(eq(todos.dailyDate, date), isNull(todos.deletedAt), notInArray(todos.id, incomingIds)))
            }

            for (const t of parsed.todos) {
              await tx
                .insert(todos)
                .values({
                  id: t.id,
                  dailyDate: date,
                  title: t.title,
                  status: t.status,
                  topicName: t.topicName,
                  deletedAt: null,
                  createdAt: now,
                  updatedAt: now,
                })
                .onConflictDoUpdate({
                  target: todos.id,
                  set: {
                    dailyDate: date,
                    title: t.title,
                    status: t.status,
                    topicName: t.topicName,
                    deletedAt: null,
                    updatedAt: now,
                  },
                })

              // Ensure a notes row exists for each todo.
              await tx
                .insert(todoNotes)
                .values({
                  todoId: t.id,
                  markdown: '',
                  updatedAt: now,
                })
                .onConflictDoNothing()
            }

            // Topics + topic entries
            const topicNames = Array.from(new Set(parsed.topicEntries.map((e) => e.topicName)))
            if (topicNames.length) {
              await tx
                .insert(topics)
                .values(topicNames.map((name) => ({ name, createdAt: now })))
                .onConflictDoNothing()
            }

            await tx.delete(topicEntries).where(eq(topicEntries.dailyDate, date))

            if (parsed.topicEntries.length) {
              await tx.insert(topicEntries).values(
                parsed.topicEntries.map((e) => ({
                  id: crypto.randomUUID(),
                  topicName: e.topicName,
                  dailyDate: date,
                  contentMarkdown: e.contentMarkdown,
                  createdAt: now,
                  updatedAt: now,
                })),
              )
            }
          })

          return json({ ok: true, markdown: responseMarkdown })
        }

        return json({ ok: false, error: 'Method not allowed' }, { status: 405 })
      }
    }

    // Notes panel lists
    if (pathname === '/api/daily' && req.method === 'GET') {
      const auth = await requireUser(req)
      if (!auth.ok) return auth.response

      await ensureMigrated()
      const rows = await db()
        .select({ date: dailyNotes.date, updatedAt: dailyNotes.updatedAt })
        .from(dailyNotes)
        .orderBy(desc(dailyNotes.date))
        .limit(120)
      return json({ dates: rows.map((r) => r.date) })
    }

    if (pathname === '/api/todos' && req.method === 'GET') {
      const auth = await requireUser(req)
      if (!auth.ok) return auth.response

      await ensureMigrated()
      const status = url.searchParams.get('status') // open|done|null
      const where =
        status === 'open' || status === 'done'
          ? and(eq(todos.status, status), isNull(todos.deletedAt))
          : isNull(todos.deletedAt)

      const rows = await db()
        .select({
          id: todos.id,
          title: todos.title,
          status: todos.status,
          dueAt: todos.dueAt,
          topicName: todos.topicName,
          dailyDate: todos.dailyDate,
          updatedAt: todos.updatedAt,
        })
        .from(todos)
        .where(where)
        .orderBy(desc(todos.updatedAt))
        .limit(200)

      return json({ todos: rows })
    }

    {
      const m = pathname.match(/^\/api\/todos\/([^/]+)$/)
      if (m) {
        const auth = await requireUser(req)
        if (!auth.ok) return auth.response

        await ensureMigrated()
        const id = decodeURIComponent(m[1])

        if (req.method === 'GET') {
          const rows = await db()
            .select({
              id: todos.id,
              title: todos.title,
              status: todos.status,
              dueAt: todos.dueAt,
              topicName: todos.topicName,
              dailyDate: todos.dailyDate,
              updatedAt: todos.updatedAt,
              notesMarkdown: todoNotes.markdown,
              notesUpdatedAt: todoNotes.updatedAt,
            })
            .from(todos)
            .leftJoin(todoNotes, eq(todoNotes.todoId, todos.id))
            .where(and(eq(todos.id, id), isNull(todos.deletedAt)))
            .limit(1)

          const row = rows[0]
          if (!row) return json({ ok: false, error: 'Not found' }, { status: 404 })

          return json({
            todo: {
              id: row.id,
              title: row.title,
              status: row.status,
              dueAt: row.dueAt,
              topicName: row.topicName,
              dailyDate: row.dailyDate,
              updatedAt: row.updatedAt,
            },
            notes: {
              markdown: row.notesMarkdown ?? '',
              updatedAt: row.notesUpdatedAt ?? null,
            },
          })
        }

        if (req.method === 'PUT') {
          const body = await readJson(
            req,
            z.object({
              status: z.string().optional(),
              title: z.string().optional(),
            }),
          )

          const now = new Date()
          const nextStatus = typeof body.status === 'string' ? body.status : undefined

          try {
            await db().transaction(async (tx) => {
            const existing = await tx
              .select({ id: todos.id, dailyDate: todos.dailyDate, status: todos.status })
              .from(todos)
              .where(and(eq(todos.id, id), isNull(todos.deletedAt)))
              .limit(1)

            const row = existing[0]
            if (!row) {
              throw Object.assign(new Error('Not found'), { statusCode: 404 })
            }

            await tx
              .update(todos)
              .set({
                ...(typeof body.status === 'string' ? { status: body.status } : {}),
                ...(typeof body.title === 'string' ? { title: body.title } : {}),
                updatedAt: now,
              })
              .where(and(eq(todos.id, id), isNull(todos.deletedAt)))

            // If status changed, reflect it back into the daily markdown source line.
            if (nextStatus && (nextStatus === 'open' || nextStatus === 'done')) {
              const note = await tx
                .select({ markdown: dailyNotes.markdown })
                .from(dailyNotes)
                .where(eq(dailyNotes.date, row.dailyDate))
                .limit(1)

              const currentMd = note[0]?.markdown ?? ''
              const updatedMd = toggleTodoCheckboxInMarkdown(currentMd, id, nextStatus === 'done')

              if (updatedMd !== currentMd) {
                await tx
                  .update(dailyNotes)
                  .set({ markdown: updatedMd, updatedAt: now })
                  .where(eq(dailyNotes.date, row.dailyDate))
              }
            }
            })
          } catch (e) {
            if (typeof (e as { statusCode?: unknown })?.statusCode === 'number') {
              const statusCode = Number((e as { statusCode: number }).statusCode)
              return json({ ok: false, error: 'Not found' }, { status: statusCode })
            }
            throw e
          }

          return json({ ok: true })
        }

        return json({ ok: false, error: 'Method not allowed' }, { status: 405 })
      }
    }

    {
      const m = pathname.match(/^\/api\/todos\/([^/]+)\/notes$/)
      if (m) {
        const auth = await requireUser(req)
        if (!auth.ok) return auth.response
        await ensureMigrated()
        const id = decodeURIComponent(m[1])

        if (req.method === 'PUT') {
          const body = await readJson(req, z.object({ markdown: z.string() }))
          const now = new Date()

          await db()
            .insert(todoNotes)
            .values({ todoId: id, markdown: body.markdown, updatedAt: now })
            .onConflictDoUpdate({
              target: todoNotes.todoId,
              set: { markdown: body.markdown, updatedAt: now },
            })

          return json({ ok: true })
        }

        return json({ ok: false, error: 'Method not allowed' }, { status: 405 })
      }
    }

    if (pathname === '/api/topics' && req.method === 'GET') {
      const auth = await requireUser(req)
      if (!auth.ok) return auth.response

      await ensureMigrated()
      // Only show topics that have at least one associated topic entry (note).
      // We keep the original topics.createdAt ordering.
      const rows = await db()
        .select({ name: topics.name })
        .from(topics)
        .innerJoin(topicEntries, eq(topicEntries.topicName, topics.name))
        .groupBy(topics.name)
        .orderBy(desc(topics.createdAt))
        .limit(200)

      return json({ topics: rows.map((r) => r.name) })
    }

    {
      const m = pathname.match(/^\/api\/topics\/([^/]+)$/)
      if (m) {
        const auth = await requireUser(req)
        if (!auth.ok) return auth.response

        await ensureMigrated()
        const name = decodeURIComponent(m[1])

        const exists = await db().select({ name: topics.name }).from(topics).where(eq(topics.name, name)).limit(1)
        if (!exists[0]) return json({ ok: false, error: 'Not found' }, { status: 404 })

        const rows = await db()
          .select({
            id: topicEntries.id,
            dailyDate: topicEntries.dailyDate,
            contentMarkdown: topicEntries.contentMarkdown,
            updatedAt: topicEntries.updatedAt,
          })
          .from(topicEntries)
          .where(eq(topicEntries.topicName, name))
          .orderBy(desc(topicEntries.dailyDate), desc(topicEntries.updatedAt))
          .limit(500)

        return json({
          topic: name,
          entries: rows.map((r) => ({
            id: r.id,
            dailyDate: r.dailyDate,
            contentMarkdown: r.contentMarkdown,
            updatedAt: r.updatedAt,
          })),
        })
      }
    }

    // Everything else requires auth (single-user private app).
    if (pathname.startsWith('/api/')) {
      const auth = await requireUser(req)
      if (!auth.ok) return auth.response
    }

    return json({ ok: false, error: 'Not found' }, { status: 404 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return json({ ok: false, error: 'Invalid request', details: err.flatten() }, { status: 400 })
    }
    console.error(err)
    return json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}

