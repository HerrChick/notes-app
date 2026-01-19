import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { Decoration, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder, type Extension } from '@codemirror/state'
import { useMemo } from 'react'
import type { MutableRefObject } from 'react'
import { useSettings } from '../settings/useSettings'

const TODO_MARKER_RE = /<!--todo:[a-f0-9-]{8,}-->/gi

function todoMarkerDecorations(mode: 'hide' | 'show'): Extension {
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
    { decorations: (v) => v.decorations },
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
    () => [markdown(), EditorView.lineWrapping, todoMarkerDecorations(markerMode)],
    [markerMode],
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

