import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiJson } from '../lib/apiClient'
import {
  emitDailyChangedThrottled,
  emitTodosChangedThrottled,
  emitTopicsChangedThrottled,
  onLocalOnlyEvent,
  setEditorActive,
} from '../lib/appEvents'
import { MarkdownEditor } from '../components/MarkdownEditor'
import { Spinner } from '../components/Spinner'
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { useSettings } from '../settings/useSettings'

const TODO_MARKER_RE = /<!--todo:[a-f0-9-]{8,}-->/i
const TODO_LINE_RE = /^(\s*-\s*\[)( |x|X)(\])(\s+)(.+?)\s*$/

function isActiveUnmarkedTodoLine(view: NonNullable<ReactCodeMirrorRef['view']>): boolean {
  const head = view.state.selection.main.head
  const line = view.state.doc.lineAt(head)
  const text = line.text
  if (TODO_MARKER_RE.test(text)) return false
  const m = text.match(TODO_LINE_RE)
  if (!m) return false
  const rawText = m[5]
  return !!rawText?.trim()
}

export function DailyRoute() {
  const { date } = useParams()
  const title = useMemo(() => (date ? `Daily · ${date}` : 'Daily'), [date])

  const { settings } = useSettings()

  const editorRef = useRef<ReactCodeMirrorRef | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [markdown, setMarkdown] = useState<string>('')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const lastSavedRef = useRef<string>('')
  const markdownRef = useRef<string>('')
  const saveSeqRef = useRef<number>(0)

  useEffect(() => {
    markdownRef.current = markdown
  }, [markdown])

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
      if (!date) return
      setLoading(true)
      setError(null)
      try {
        const res = await apiJson<{ date: string; markdown: string }>(`/api/daily/${date}`)
        if (cancelled) return
        setMarkdown(res.markdown)
        lastSavedRef.current = res.markdown
        setSaveStatus('saved')
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load note')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [date])

  useEffect(() => {
    if (!date) return
    if (loading) return
    if (markdown === lastSavedRef.current) return

    const t = window.setTimeout(async () => {
      const view = editorRef.current?.view
      // If we want todo IDs generated only when leaving the line, avoid autosaving
      // while the cursor is still on a todo line that doesn't yet have an id.
      // Otherwise the server will inject a marker on idle and we’d have to apply it.
      if (settings.todoIdInsertionTiming === 'cursorLeavesLine' && view && isActiveUnmarkedTodoLine(view)) {
        return
      }

      const saveSeq = ++saveSeqRef.current
      const snapshot = markdownRef.current
      try {
        setSaveStatus('saving')
        const res = await apiJson<{ ok: true; markdown: string }>(`/api/daily/${date}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ markdown: snapshot }),
        })

        // If a newer save started after this one, ignore this response.
        if (saveSeq !== saveSeqRef.current) return

        // If the user has typed since this request was sent, don't overwrite the
        // editor with server markdown (avoid "disappearing text" mid-type).
        if (settings.applyServerRewritePolicy === 'applyOnlyIfUnchanged' && markdownRef.current !== snapshot) return

        const serverMarkdown = res.markdown
        lastSavedRef.current = serverMarkdown

        // If the server added todo-id markers, update the editor content while
        // keeping selection as stable as possible.
        if (serverMarkdown !== snapshot) {
          const view = editorRef.current?.view
          if (view) {
            const scrollTop = view.scrollDOM.scrollTop
            const scrollLeft = view.scrollDOM.scrollLeft
            const sel = view.state.selection.main
            const max = serverMarkdown.length
            view.dispatch({
              changes: { from: 0, to: view.state.doc.length, insert: serverMarkdown },
              selection: {
                anchor: Math.min(sel.anchor, max),
                head: Math.min(sel.head, max),
              },
            })

            // Replacing the full document can reset scroll position (especially
            // when the backend injects todo-id markers). Preserve what the user
            // was looking at.
            requestAnimationFrame(() => {
              view.scrollDOM.scrollTop = scrollTop
              view.scrollDOM.scrollLeft = scrollLeft
            })
          }
          setMarkdown(serverMarkdown)
        }

        setSaveStatus('saved')

        // The backend may derive todos/topics from daily markdown, so notify other
        // mounted lists (and other tabs) to refetch. Throttled to avoid thrash
        // while typing.
        emitDailyChangedThrottled({ date })
        emitTodosChangedThrottled(undefined)
        emitTopicsChangedThrottled(undefined)
      } catch {
        if (saveSeq !== saveSeqRef.current) return
        setSaveStatus('error')
      }
    }, settings.autosaveDebounceMs)

    return () => window.clearTimeout(t)
  }, [
    date,
    loading,
    markdown,
    settings.applyServerRewritePolicy,
    settings.autosaveDebounceMs,
    settings.todoIdInsertionTiming,
  ])

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-surface px-5 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-text">{title}</div>
          <div className="text-xs text-muted">Autosave enabled</div>
        </div>
        <div className="flex min-w-[32px] items-center justify-end text-xs text-muted">
          {loading ? (
            <Spinner label="Loading note" size="sm" />
          ) : saveStatus === 'saving' ? (
            <Spinner label="Saving" size="sm" />
          ) : saveStatus === 'error' ? (
            'Save failed'
          ) : (
            'Saved'
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 p-4">
        <div className="h-full overflow-hidden rounded-xl border border-border bg-bg">
          {loading ? (
            <div className="flex h-full items-center justify-center p-4 text-sm text-muted">
              <Spinner label="Loading note" size="md" />
            </div>
          ) : error ? (
            <div className="p-4 text-sm text-muted">{error}</div>
          ) : (
            <MarkdownEditor value={markdown} onChange={setMarkdown} editorRef={editorRef} />
          )}
        </div>
      </div>
    </div>
  )
}

