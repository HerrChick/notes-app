import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { apiJson } from '../lib/apiClient'
import { emitTodosChanged, onAppEvent } from '../lib/appEvents'

export function TodosRoute() {
  const [filter, setFilter] = useState<'open' | 'done' | 'all'>('open')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<TodoListItem[]>([])

  const query = useMemo(() => {
    if (filter === 'all') return '/api/todos'
    return `/api/todos?status=${filter}`
  }, [filter])

  const refresh = useCallback(
    async (isActive?: () => boolean) => {
      if (isActive && !isActive()) return
      setLoading(true)
      setError(null)
      try {
        const res = await apiJson<{ todos: TodoListItem[] }>(query)
        if (isActive && !isActive()) return
        setItems(res.todos)
      } catch (e) {
        if (isActive && !isActive()) return
        setError(e instanceof Error ? e.message : 'Failed to load todos')
      } finally {
        if (isActive && !isActive()) return
        setLoading(false)
      }
    },
    [query],
  )

  useEffect(() => {
    let cancelled = false
    const active = () => !cancelled

    void refresh(active)
    const off = onAppEvent('todosChanged', () => {
      void refresh(active)
    })

    return () => {
      cancelled = true
      off()
    }
  }, [refresh])

  async function toggle(todo: TodoListItem) {
    const next = todo.status === 'done' ? 'open' : 'done'
    setItems((prev) => prev.map((t) => (t.id === todo.id ? { ...t, status: next } : t)))
    try {
      await apiJson<{ ok: true }>(`/api/todos/${encodeURIComponent(todo.id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      emitTodosChanged({ todoId: todo.id, dailyDate: todo.dailyDate })
    } catch {
      // revert on failure
      setItems((prev) => prev.map((t) => (t.id === todo.id ? todo : t)))
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-surface px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold text-text">Tasks</div>
          <div className="flex items-center rounded-lg border border-border bg-surface-2 p-1 text-xs">
            <FilterButton value="open" current={filter} set={setFilter}>
              Open
            </FilterButton>
            <FilterButton value="done" current={filter} set={setFilter}>
              Done
            </FilterButton>
            <FilterButton value="all" current={filter} set={setFilter}>
              All
            </FilterButton>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-lg border border-primary-600 bg-surface-2 px-3 py-1.5 text-xs font-medium text-primary-400 hover:bg-bg"
        >
          Refresh
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? <div className="p-2 text-sm text-muted">Loading…</div> : null}
        {error ? <div className="p-2 text-sm text-muted">{error}</div> : null}

        <div className="space-y-2">
          {items.map((t) => (
            <div
              key={t.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-bg px-4 py-3"
            >
              <button
                type="button"
                onClick={() => void toggle(t)}
                aria-label={t.status === 'done' ? 'Mark open' : 'Mark done'}
                className="mt-0.5 h-5 w-5 rounded border border-border bg-surface-2 text-primary-400 hover:border-primary-600"
              >
                {t.status === 'done' ? '✓' : ''}
              </button>
              <div className="min-w-0 flex-1">
                <Link
                  to={`/todos/${encodeURIComponent(t.id)}`}
                  className="block truncate text-sm font-medium text-text hover:text-primary-400"
                >
                  {t.title}
                </Link>
                <div className="mt-0.5 truncate text-xs text-muted">
                  {t.topicName ? `#${t.topicName}` : 'Uncategorized'} · {t.dailyDate}
                </div>
              </div>
            </div>
          ))}

          {!loading && items.length === 0 ? (
            <div className="p-2 text-sm text-muted">No tasks to show.</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

type TodoListItem = {
  id: string
  title: string
  status: 'open' | 'done' | string
  topicName: string | null
  dailyDate: string
}

function FilterButton({
  value,
  current,
  set,
  children,
}: {
  value: 'open' | 'done' | 'all'
  current: 'open' | 'done' | 'all'
  set: (v: 'open' | 'done' | 'all') => void
  children: ReactNode
}) {
  const active = value === current
  return (
    <button
      type="button"
      onClick={() => set(value)}
      className={`rounded-md px-2 py-1 transition ${
        active ? 'bg-bg text-primary-400' : 'text-muted hover:text-text'
      }`}
    >
      {children}
    </button>
  )
}

