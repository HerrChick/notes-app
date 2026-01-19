export type AuthStatus =
  | { authenticated: true; needsSetup: false; username: string }
  | { authenticated: false; needsSetup: boolean }

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const text = await res.text()
  const data: unknown = text ? JSON.parse(text) : null
  if (!res.ok) {
    const message =
      typeof (data as { error?: unknown } | null)?.error === 'string'
        ? String((data as { error: string }).error)
        : `Request failed (${res.status})`
    throw new Error(message)
  }
  return data as T
}

export function getAuthStatus() {
  return api<AuthStatus>('/api/auth/status', { method: 'GET' })
}

export function setupAccount(input: { username: string; password: string }) {
  return api<{ ok: true }>('/api/auth/setup', { method: 'POST', body: JSON.stringify(input) })
}

export function login(input: { username: string; password: string }) {
  return api<{ ok: true }>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) })
}

export function logout() {
  return api<{ ok: true }>('/api/auth/logout', { method: 'POST' })
}

