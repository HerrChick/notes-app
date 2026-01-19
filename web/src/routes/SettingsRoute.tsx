import { useMemo } from 'react'
import { useSettings } from '../settings/useSettings'

export function SettingsRoute() {
  const { settings, setShowTodoIds } = useSettings()

  const title = useMemo(() => 'Settings', [])

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-surface px-5 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-text">{title}</div>
          <div className="text-xs text-muted">Editor + display preferences</div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto w-full max-w-2xl space-y-3">
          <div className="rounded-xl border border-border bg-bg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text">Show todo IDs</div>
                <div className="mt-1 text-sm text-muted">
                  Controls whether the editor shows the hidden <code>{'<!--todo:...-->'}</code> markers. When enabled,
                  they’re styled in orange.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowTodoIds(!settings.showTodoIds)}
                className={[
                  'shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                  settings.showTodoIds
                    ? 'border-primary-600 bg-surface-2 text-primary-400 hover:bg-bg'
                    : 'border-border bg-surface text-muted hover:border-primary-600 hover:text-primary-400',
                ].join(' ')}
              >
                {settings.showTodoIds ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

