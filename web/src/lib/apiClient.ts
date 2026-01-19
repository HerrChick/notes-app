export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'include', ...init })
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

