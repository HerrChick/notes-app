import { handleApiRequest } from '../../../api/src/router'

function toHeaders(headers: Record<string, string | string[] | undefined>): Headers {
  const out = new Headers()
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v === 'string') out.set(k, v)
    else if (Array.isArray(v)) out.set(k, v.join(','))
  }
  return out
}

export async function handler(event: any) {
  const rawUrl: string | undefined = event.rawUrl
  const host = event.headers?.host ?? 'localhost'
  const baseUrl = rawUrl ? new URL(rawUrl) : new URL(`https://${host}${event.path}`)

  // Netlify function URLs look like `/.netlify/functions/api/...`
  // We normalize them to our internal API shape: `/api/...`.
  const normalizedPath = String(event.path || '').replace(
    /^\\/\\.netlify\\/functions\\/api/,
    '/api',
  )
  baseUrl.pathname = normalizedPath

  const body =
    event.body && event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : event.body
        ? event.body
        : undefined

  const req = new Request(baseUrl.toString(), {
    method: event.httpMethod,
    headers: toHeaders(event.headers || {}),
    body,
  })

  const res = await handleApiRequest(req)
  const resBody = await res.text()
  const resHeaders: Record<string, string> = {}
  res.headers.forEach((value, key) => {
    resHeaders[key] = value
  })

  return {
    statusCode: res.status,
    headers: resHeaders,
    body: resBody,
  }
}

