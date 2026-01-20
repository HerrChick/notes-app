import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiJson } from '../lib/apiClient'
import { emitTodosChanged, onLocalOnlyEvent, setEditorActive } from '../lib/appEvents'
import { MarkdownEditor } from '../components/MarkdownEditor'
import { Spinner } from '../components/Spinner'
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { useSettings } from '../settings/useSettings'

export function TodoDetailRoute() {
  const { id } = useParams()
  const todoId = id ? decodeURIComponent(id) : null

  const { settings } = useSettings()

  const editorRef = useRef<ReactCodeMirrorRef | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [todo, setTodo] = useState<Todo | null>(null)
  const [notes, setNotes] = useState<string>('')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const lastSavedRef = useRef<string>('')

  const title = useMemo(() => todo?.title ?? 'Task', [todo?.title])

  useEffect(() => {
    setEditorActive(true)
    return () => setEditorActive(false)
  }, [])

  useEffect(() => {
    return onLocalOnlyEvent('editorInsertText', ({ text }) => {
      const view = editorRef.current?.view
      if (!view) return

      const sel = view.state.selection.main
      const from = sel.from
      const to = sel.to
      const nextPos = from + text.length

      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: nextPos },
      })
      view.focus()
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!todoId) return
      setLoading(true)
      setError(null)
      try {
        const res = await apiJson<{ todo: Todo; notes: { markdown: string } }>(
          `/api/todos/${encodeURIComponent(todoId)}`,
        )
        if (cancelled) return
        setTodo(res.todo)
        setNotes(res.notes.markdown ?? '')
        lastSavedRef.current = res.notes.markdown ?? ''
        setSaveStatus('saved')
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load todo')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [todoId])

  useEffect(() => {
    if (!todoId) return
    if (loading) return
    if (notes === lastSavedRef.current) return

    setSaveStatus('saving')
    const t = window.setTimeout(async () => {
      try {
        await apiJson<{ ok: true }>(`/api/todos/${encodeURIComponent(todoId)}/notes`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ markdown: notes }),
        })
        lastSavedRef.current = notes
        setSaveStatus('saved')
      } catch {
        setSaveStatus('error')
      }
    }, settings.autosaveDebounceMs)

    return () => window.clearTimeout(t)
  }, [todoId, loading, notes, settings.autosaveDebounceMs])

  async function toggleStatus() {
    if (!todo) return
    const next = todo.status === 'done' ? 'open' : 'done'
    setTodo({ ...todo, status: next })
    try {
      await apiJson<{ ok: true }>(`/api/todos/${encodeURIComponent(todo.id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      emitTodosChanged({ todoId: todo.id, dailyDate: todo.dailyDate })
    } catch {
      setTodo(todo)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-surface px-5 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-text">{title}</div>
          <div className="truncate text-xs text-muted">
            {todo?.topicName ? `#${todo.topicName}` : 'Uncategorized'}
            {todo?.dailyDate ? (
              <>
                {' '}
                ·{' '}
                <Link to={`/daily/${todo.dailyDate}`} className="text-primary-400 hover:underline">
                  {todo.dailyDate}
                </Link>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="flex min-w-[32px] items-center justify-end">
            {loading ? (
              <Spinner label="Loading task" size="sm" />
            ) : saveStatus === 'saving' ? (
              <Spinner label="Saving" size="sm" />
            ) : saveStatus === 'error' ? (
              'Save failed'
            ) : (
              'Saved'
            )}
          </span>
          <button
            type="button"
            onClick={() => void toggleStatus()}
            className="rounded-lg border border-primary-600 bg-surface-2 px-3 py-1.5 text-xs font-medium text-primary-400 hover:bg-bg"
          >
            {todo?.status === 'done' ? 'Mark open' : 'Mark done'}
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 p-4">
        <div className="h-full overflow-hidden rounded-xl border border-border bg-bg">
          {loading ? (
            <div className="flex h-full items-center justify-center p-4 text-sm text-muted">
              <Spinner label="Loading task" size="md" />
            </div>
          ) : error ? (
            <div className="p-4 text-sm text-muted">{error}</div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="border-b border-border bg-surface px-4 py-3">
                <div className="truncate text-base font-semibold text-text">{title}</div>
                <div className="truncate text-xs text-muted">Task notes</div>
              </div>
              <div className="min-h-0 flex-1">
                <MarkdownEditor value={notes} onChange={setNotes} editorRef={editorRef} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

type Todo = {
  id: string
  title: string
  status: 'open' | 'done' | string
  dueAt: string | null
  topicName: string | null
  dailyDate: string
  updatedAt: string
}

