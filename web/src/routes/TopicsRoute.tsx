import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiJson } from '../lib/apiClient'
import { onAppEvent } from '../lib/appEvents'
import { Spinner } from '../components/Spinner'

export function TopicsRoute() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    async function refresh() {
      setLoading(true)
      setError(null)
      try {
        const res = await apiJson<{ topics: string[] }>('/api/topics')
        if (!cancelled) setItems(res.topics)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load topics')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void refresh()
    const off = onAppEvent('topicsChanged', () => {
      void refresh()
    })
    return () => {
      cancelled = true
      off()
    }
  }, [])

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-surface px-5 py-3">
        <div className="text-sm font-semibold text-text">Topics</div>
        {loading ? <Spinner label="Loading topics" size="sm" className="text-muted" /> : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error ? <div className="p-2 text-sm text-muted">{error}</div> : null}

        <div className="space-y-2">
          {items.map((name) => (
            <Link
              key={name}
              to={`/topics/${encodeURIComponent(name)}`}
              className="block rounded-xl border border-border bg-bg px-4 py-3 text-sm font-medium text-text hover:border-primary-600"
            >
              {name}
            </Link>
          ))}

          {!loading && items.length === 0 ? (
            <div className="p-2 text-sm text-muted">No topics yet.</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

