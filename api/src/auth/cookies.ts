export function parseCookies(cookieHeader: string | null | undefined): Record<string, string> {
  if (!cookieHeader) return {}
  const out: Record<string, string> = {}
  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=')
    if (!rawName) continue
    out[rawName] = decodeURIComponent(rawValue.join('=') || '')
  }
  return out
}

type CookieOptions = {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Lax' | 'Strict' | 'None'
  path?: string
  maxAge?: number
  expires?: Date
}

export function serializeCookie(name: string, value: string, opts: CookieOptions = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`]
  parts.push(`Path=${opts.path ?? '/'}`)
  if (opts.httpOnly ?? true) parts.push('HttpOnly')
  if (opts.secure ?? process.env.NODE_ENV === 'production') parts.push('Secure')
  parts.push(`SameSite=${opts.sameSite ?? 'Lax'}`)
  if (typeof opts.maxAge === 'number') parts.push(`Max-Age=${opts.maxAge}`)
  if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`)
  return parts.join('; ')
}

