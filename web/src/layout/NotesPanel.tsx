import { clsx } from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, useMatch } from 'react-router-dom'
import { apiJson } from '../lib/apiClient'
import { todayISO } from '../lib/dates'
import { emitTodosChanged, onAppEvent } from '../lib/appEvents'

type TabKey = 'daily' | 'tasks' | 'topics'

export function NotesPanel() {
  const [tab, setTab] = useState<TabKey>('daily')

  return (
    <aside className="flex h-full flex-col border-r border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <div className="text-sm font-semibold tracking-wide text-text">Notes</div>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg border border-border bg-surface-2 p-1 text-xs">
          <TabButton tab={tab} setTab={setTab} value="daily">
            Daily
          </TabButton>
          <TabButton tab={tab} setTab={setTab} value="tasks">
            Tasks
          </TabButton>
          <TabButton tab={tab} setTab={setTab} value="topics">
            Topics
          </TabButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {tab === 'daily' && <DailyList />}
        {tab === 'tasks' && <TasksList />}
        {tab === 'topics' && <TopicsList />}
      </div>
    </aside>
  )
}

function TabButton({
  tab,
  value,
  setTab,
  children,
}: {
  tab: TabKey
  value: TabKey
  setTab: (t: TabKey) => void
  children: ReactNode
}) {
  const active = tab === value
  return (
    <button
      type="button"
      onClick={() => setTab(value)}
      className={clsx(
        'rounded-md px-2 py-1.5 text-center transition',
        active ? 'bg-bg text-primary-400' : 'text-muted hover:text-text',
      )}
    >
      {children}
    </button>
  )
}

function DailyList() {
  const match = useMatch('/daily/:date')
  const selectedDate = match?.params.date
  const fallbackDates = useMemo(() => [todayISO()], [])
  const [dates, setDates] = useState<string[]>(fallbackDates)
  const [, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function refresh() {
      setLoading(true)
      try {
        const res = await apiJson<{ dates: string[] }>('/api/daily')
        if (!cancelled) setDates(res.dates)
      } catch {
        // keep fallback
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void refresh()
    const off = onAppEvent('dailyChanged', () => {
      void refresh()
    })
    return () => {
      cancelled = true
      off()
    }
  }, [])

  return (
    <div className="space-y-1">
      {dates.map((date) => (
        <NavLink
          key={date}
          to={`/daily/${date}`}
          className={({ isActive }) =>
            clsx(
              'flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition',
              isActive
                ? 'border-primary-600 bg-surface-2 text-primary-400'
                : 'border-border bg-surface text-text hover:border-primary-600',
            )
          }
        >
          <span className="font-medium">{date}</span>
          {selectedDate === date ? (
            <span className="text-xs text-primary-400">open</span>
          ) : null}
        </NavLink>
      ))}
    </div>
  )
}

type TodoListItem = {
  id: string
  title: string
  status: string
  topicName: string | null
  dailyDate: string
}

function TasksList() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<TodoListItem[]>([])

  useEffect(() => {
    let cancelled = false
    async function refresh() {
      setLoading(true)
      try {
        const res = await apiJson<{ todos: TodoListItem[] }>('/api/todos?status=open')
        if (!cancelled) setItems(res.todos)
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void refresh()
    const off = onAppEvent('todosChanged', () => {
      void refresh()
    })
    return () => {
      cancelled = true
      off()
    }
  }, [])

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

      // If it was open and we marked it done, remove it from the "Open tasks" list.
      if (next === 'done') {
        setItems((prev) => prev.filter((t) => t.id !== todo.id))
      }
    } catch {
      // revert on failure
      setItems((prev) => prev.map((t) => (t.id === todo.id ? todo : t)))
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-2 py-1">
        <div className="text-xs font-medium text-muted">Open tasks</div>
        <Link to="/todos" className="text-xs text-primary-400 hover:underline">
          View all
        </Link>
      </div>

      {items.length === 0 && !loading ? (
        <div className="p-2 text-sm text-muted">No open tasks.</div>
      ) : null}

      <div className="space-y-1">
        {items.slice(0, 50).map((t) => (
          <div
            key={t.id}
            className="flex items-start gap-2 rounded-lg border border-border bg-surface px-2.5 py-2 text-sm text-text hover:border-primary-600"
          >
            <button
              type="button"
              onClick={() => void toggle(t)}
              aria-label="Mark done"
              className="mt-0.5 h-4 w-4 rounded border border-border bg-surface-2 text-primary-400 hover:border-primary-600"
            />
            <Link to={`/todos/${encodeURIComponent(t.id)}`} className="min-w-0 flex-1">
              <div className="truncate font-medium">{t.title}</div>
              <div className="mt-0.5 truncate text-xs text-muted">
                {t.topicName ? `#${t.topicName}` : 'Uncategorized'} · {t.dailyDate}
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}

function TopicsList() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    async function refresh() {
      setLoading(true)
      try {
        const res = await apiJson<{ topics: string[] }>('/api/topics')
        if (!cancelled) setItems(res.topics)
      } catch {
        // ignore
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
    <div className="space-y-2">
      <div className="flex items-center justify-between px-2 py-1">
        <div className="text-xs font-medium text-muted">Topics</div>
        <Link to="/topics" className="text-xs text-primary-400 hover:underline">
          View all
        </Link>
      </div>

      {items.length === 0 && !loading ? (
        <div className="p-2 text-sm text-muted">No topics yet.</div>
      ) : null}

      <div className="space-y-1">
        {items.slice(0, 80).map((name) => (
          <Link
            key={name}
            to={`/topics/${encodeURIComponent(name)}`}
            className="block rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text hover:border-primary-600"
          >
            {name}
          </Link>
        ))}
      </div>
    </div>
  )
}

