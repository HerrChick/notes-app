import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiJson } from '../lib/apiClient'
import { MarkdownPreview } from '../components/MarkdownPreview'
import { onAppEvent } from '../lib/appEvents'
import { Spinner } from '../components/Spinner'

export function TopicDetailRoute() {
  const { name } = useParams()
  const topicName = useMemo(() => (name ? decodeURIComponent(name) : ''), [name])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entries, setEntries] = useState<TopicEntry[]>([])

  useEffect(() => {
    let cancelled = false
    async function refresh() {
      if (!topicName) return
      setLoading(true)
      setError(null)
      try {
        const res = await apiJson<{ topic: string; entries: TopicEntry[] }>(
          `/api/topics/${encodeURIComponent(topicName)}`,
        )
        if (!cancelled) setEntries(res.entries)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load topic')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void refresh()
    const offTopics = onAppEvent('topicsChanged', () => {
      void refresh()
    })
    const offDaily = onAppEvent('dailyChanged', () => {
      void refresh()
    })
    return () => {
      cancelled = true
      offTopics()
      offDaily()
    }
  }, [topicName])

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-surface px-5 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-text">Topic</div>
          <div className="truncate text-xs text-muted">{topicName}</div>
        </div>
        <div className="text-xs text-muted">
          {loading ? <Spinner label="Loading topic" size="sm" className="text-muted" /> : `${entries.length} entries`}
        </div>
      </header>

      <div className="min-h-0 flex-1 p-4">
        {loading ? (
          <div className="flex items-center justify-center p-6 text-sm text-muted">
            <Spinner label="Loading topic" size="md" />
          </div>
        ) : error ? (
          <div className="p-2 text-sm text-muted">{error}</div>
        ) : (
          <div className="space-y-3">
            {entries.map((e) => (
              <div key={e.id} className="rounded-xl border border-border bg-bg p-4">
                <div className="mb-2 flex items-center justify-between">
                  <Link
                    to={`/daily/${e.dailyDate}`}
                    className="text-xs font-medium text-primary-400 hover:underline"
                  >
                    {e.dailyDate}
                  </Link>
                  <div className="text-xs text-muted">Updated {new Date(e.updatedAt).toLocaleString()}</div>
                </div>
                <MarkdownPreview markdown={e.contentMarkdown} />
              </div>
            ))}

            {entries.length === 0 ? (
              <div className="p-2 text-sm text-muted">No entries for this topic yet.</div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

type TopicEntry = {
  id: string
  dailyDate: string
  contentMarkdown: string
  updatedAt: string
}

