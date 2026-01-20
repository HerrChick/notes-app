import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { insertNewlineAndIndent } from '@codemirror/commands'
import { Decoration, EditorView, ViewPlugin, keymap, type ViewUpdate } from '@codemirror/view'
import { Prec, RangeSetBuilder, type Extension } from '@codemirror/state'
import { useMemo } from 'react'
import type { MutableRefObject } from 'react'
import { useSettings } from '../settings/useSettings'

const TODO_MARKER_RE = /<!--todo:[a-f0-9-]{8,}-->/gi
const TODO_MARKER_RE_SINGLE = /<!--todo:[a-f0-9-]{8,}-->/i
const TODO_LINE_RE = /^(\s*-\s*\[)( |x|X)(\])(\s+)(.+?)\s*$/

function randomTodoId(): string {
  // Modern browsers + secure contexts support this; fallback is fine for local-only ids.
  try {
    return crypto.randomUUID()
  } catch {
    return `fallback-${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`
  }
}

function ensureTodoIdOnLineExit(): Extension {
  return ViewPlugin.fromClass(
    class {
      update(update: ViewUpdate) {
        if (update.view.composing) return
        if (!update.selectionSet && !update.docChanged) return

        const prevHead = update.startState.selection.main.head
        const nextHead = update.state.selection.main.head

        const prevLineInStart = update.startState.doc.lineAt(prevHead)
        const prevLineFromMapped = update.changes.mapPos(prevLineInStart.from)
        const prevLineInNow = update.state.doc.lineAt(prevLineFromMapped)

        const nextLine = update.state.doc.lineAt(nextHead)

        // Only act when the cursor actually leaves the previous line (including Enter).
        if (prevLineInNow.number === nextLine.number) return

        const text = prevLineInNow.text
        if (TODO_MARKER_RE_SINGLE.test(text)) return
        const m = text.match(TODO_LINE_RE)
        if (!m) return
        const rawText = m[5]
        if (!rawText.trim()) return

        const insert = ` <!--todo:${randomTodoId()}-->`
        const insertPos = prevLineInNow.to
        const insertLen = insert.length

        // Preserve the user's current selection (e.g. after pressing Enter) so
        // it doesn't get remapped into the inserted marker.
        const sel = update.state.selection.main
        const mapPos = (pos: number) => (pos > insertPos ? pos + insertLen : pos)

        update.view.dispatch({
          changes: { from: insertPos, to: insertPos, insert },
          selection: { anchor: mapPos(sel.anchor), head: mapPos(sel.head) },
        })
      }
    },
  )
}

function ensureTodoIdOnIdle(debounceMs: number): Extension {
  return ViewPlugin.fromClass(
    class {
      private t: number | null = null

      private clear() {
        if (this.t !== null) window.clearTimeout(this.t)
        this.t = null
      }

      update(update: ViewUpdate) {
        if (update.view.composing) return
        if (!update.docChanged && !update.selectionSet) return

        this.clear()

        const view = update.view
        const head = view.state.selection.main.head
        const line = view.state.doc.lineAt(head)
        const text = line.text

        if (TODO_MARKER_RE_SINGLE.test(text)) return
        const m = text.match(TODO_LINE_RE)
        if (!m) return
        const rawText = m[5]
        if (!rawText.trim()) return

        this.t = window.setTimeout(() => {
          const v = view
          const headNow = v.state.selection.main.head
          const lineNow = v.state.doc.lineAt(headNow)
          const textNow = lineNow.text

          if (TODO_MARKER_RE_SINGLE.test(textNow)) return
          const mm = textNow.match(TODO_LINE_RE)
          if (!mm) return
          const rawNow = mm[5]
          if (!rawNow.trim()) return

          const insert = ` <!--todo:${randomTodoId()}-->`
          const insertPos = lineNow.to
          const insertLen = insert.length
          const sel = v.state.selection.main
          const mapPos = (pos: number) => (pos > insertPos ? pos + insertLen : pos)

          v.dispatch({
            changes: { from: insertPos, to: insertPos, insert },
            selection: { anchor: mapPos(sel.anchor), head: mapPos(sel.head) },
          })
        }, debounceMs)
      }

      destroy() {
        this.clear()
      }
    },
  )
}

function keepTodoMarkerOnEnter(): Extension {
  // If the cursor is "visually" at the end of a todo line, it may actually be
  // sitting *before* the hidden <!--todo:...--> marker (since it's atomic /
  // replaced). Pressing Enter would then split the line and move the marker to
  // the next line. This key handler moves the cursor after the marker before
  // inserting the newline so the marker stays with the todo.
  const tailIsOnlyMarker = /^\s*<!--todo:[a-f0-9-]{8,}-->\s*$/i

  return Prec.highest(
    keymap.of([
      {
        key: 'Enter',
        run: (view) => {
          const sel = view.state.selection.main
          if (!sel.empty) return false

          const head = sel.head
          const line = view.state.doc.lineAt(head)
          const tail = view.state.doc.sliceString(head, line.to)
          if (!tail.includes('<!--todo:')) return false
          if (!tailIsOnlyMarker.test(tail)) return false

          if (head !== line.to) {
            view.dispatch({ selection: { anchor: line.to, head: line.to } })
          }

          return insertNewlineAndIndent(view)
        },
      },
    ]),
  )
}

function todoMarkerDecorations(mode: 'hide' | 'show', protectMarkers: boolean): Extension {
  const deco = mode === 'hide' ? Decoration.replace({}) : Decoration.mark({ class: 'cm-todo-marker' })

  const build = (view: EditorView) => {
    const builder = new RangeSetBuilder<Decoration>()

    for (const { from, to } of view.visibleRanges) {
      const text = view.state.doc.sliceString(from, to)
      TODO_MARKER_RE.lastIndex = 0
      for (let m = TODO_MARKER_RE.exec(text); m; m = TODO_MARKER_RE.exec(text)) {
        const start = from + m.index
        const end = start + m[0].length
        builder.add(start, end, deco)
      }
    }

    return builder.finish()
  }

  return ViewPlugin.fromClass(
    class {
      view: EditorView
      decorations: ReturnType<typeof build>

      constructor(view: EditorView) {
        this.view = view
        this.decorations = build(view)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = build(update.view)
        }
      }
    },
    protectMarkers
      ? {
          decorations: (v) => v.decorations,
          provide: (plugin) =>
            EditorView.atomicRanges.of((view) => view.plugin(plugin)?.decorations ?? Decoration.none),
        }
      : { decorations: (v) => v.decorations },
  )
}

const retrowaveTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'transparent',
      color: 'var(--color-text)',
      height: '100%',
    },
    '.cm-content': {
      caretColor: 'var(--color-primary-400)',
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: '13px',
      lineHeight: '1.6',
      padding: '16px',
    },
    '.cm-scroller': {
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      overflow: 'auto',
      minHeight: 0,
    },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-primary-400)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: 'color-mix(in oklab, var(--color-primary-500) 28%, transparent)',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-activeLine': {
      backgroundColor: 'color-mix(in oklab, var(--color-surface-2) 75%, transparent)',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: 'color-mix(in oklab, var(--color-muted) 70%, transparent)',
      border: 'none',
    },
    '.cm-todo-marker': {
      color: '#fb923c',
    },
  },
  { dark: true },
)

export type MarkdownEditorProps = {
  value: string
  onChange: (value: string) => void
  editorRef?: MutableRefObject<ReactCodeMirrorRef | null>
}

export function MarkdownEditor({ value, onChange, editorRef }: MarkdownEditorProps) {
  const { settings } = useSettings()
  const markerMode: 'hide' | 'show' = settings.showTodoIds ? 'show' : 'hide'

  const extensions = useMemo<Extension[]>(
    () => [
      markdown(),
      EditorView.lineWrapping,
      keepTodoMarkerOnEnter(),
      ...(settings.todoIdInsertionTiming === 'cursorLeavesLine' ? [ensureTodoIdOnLineExit()] : []),
      ...(settings.todoIdInsertionTiming === 'idleDebounce'
        ? [ensureTodoIdOnIdle(settings.autosaveDebounceMs)]
        : []),
      todoMarkerDecorations(markerMode, settings.protectTodoIdMarkers),
    ],
    [
      markerMode,
      settings.autosaveDebounceMs,
      settings.protectTodoIdMarkers,
      settings.todoIdInsertionTiming,
    ],
  )

  return (
    <CodeMirror
      ref={editorRef}
      value={value}
      height="100%"
      className="h-full"
      theme={retrowaveTheme}
      extensions={extensions}
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLineGutter: false,
        highlightSpecialChars: false,
      }}
      onChange={onChange}
    />
  )
}

