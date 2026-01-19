import crypto from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import { db } from '../db/client'
import { ensureMigrated } from '../db/migrate'
import { sessions, users } from '../db/schema'
import { parseCookies, serializeCookie } from './cookies'

const SESSION_COOKIE = 'session'
const SESSION_DAYS = 30

function requireSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error('SESSION_SECRET is required')
  }
  return secret
}

function tokenHash(token: string): string {
  const secret = requireSessionSecret()
  return crypto.createHmac('sha256', secret).update(token).digest('hex')
}

export async function createSessionCookie(userId: number): Promise<{ setCookie: string }> {
  await ensureMigrated()
  const token = crypto.randomBytes(32).toString('base64url')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  await db().insert(sessions).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash: tokenHash(token),
    createdAt: now,
    expiresAt,
  })

  return {
    setCookie: serializeCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: expiresAt,
    }),
  }
}

export function clearSessionCookie(): string {
  return serializeCookie(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
  })
}

export async function getAuthenticatedUser(req: Request) {
  await ensureMigrated()
  const cookieHeader = req.headers.get('cookie')
  const cookies = parseCookies(cookieHeader)
  const token = cookies[SESSION_COOKIE]
  if (!token) return null

  const now = new Date()
  const found = await db()
    .select({
      userId: sessions.userId,
      username: users.username,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash(token)), gt(sessions.expiresAt, now)))
    .limit(1)

  return found[0] ?? null
}

export async function requireUser(req: Request) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return { ok: false as const, response: new Response('Unauthorized', { status: 401 }) }
  }
  return { ok: true as const, user }
}

