import { useMemo } from 'react'
import { useSettings } from '../settings/useSettings'

export function SettingsRoute() {
  const {
    settings,
    setApplyServerRewritePolicy,
    setAutosaveDebounceMs,
    setProtectTodoIdMarkers,
    setShowTodoIds,
    setTodoIdInsertionTiming,
  } = useSettings()

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

          <div className="rounded-xl border border-border bg-bg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text">Autosave debounce</div>
                <div className="mt-1 text-sm text-muted">
                  How long the app waits after you stop typing before saving. Longer values reduce mid-thought “Saving…”
                  churn.
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <input
                  type="number"
                  min={250}
                  max={5000}
                  step={250}
                  value={settings.autosaveDebounceMs}
                  onChange={(e) => setAutosaveDebounceMs(Number(e.target.value))}
                  className="w-24 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text"
                />
                <span className="text-xs text-muted">ms</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-bg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text">Todo ID insertion</div>
                <div className="mt-1 text-sm text-muted">
                  Controls when a new todo gets its hidden <code>{'<!--todo:...-->'}</code> marker.
                </div>
              </div>

              <select
                value={settings.todoIdInsertionTiming}
                onChange={(e) => setTodoIdInsertionTiming(e.target.value as typeof settings.todoIdInsertionTiming)}
                className="shrink-0 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text"
              >
                <option value="cursorLeavesLine">When leaving the line (recommended)</option>
                <option value="idleDebounce">After idle debounce</option>
                <option value="onBlurOrNav">On blur / navigation (not implemented yet)</option>
                <option value="manualOnly">Manual only (not implemented yet)</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-bg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text">Protect todo markers</div>
                <div className="mt-1 text-sm text-muted">
                  Prevents the cursor from entering the hidden marker ranges, which avoids accidentally editing IDs.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setProtectTodoIdMarkers(!settings.protectTodoIdMarkers)}
                className={[
                  'shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                  settings.protectTodoIdMarkers
                    ? 'border-primary-600 bg-surface-2 text-primary-400 hover:bg-bg'
                    : 'border-border bg-surface text-muted hover:border-primary-600 hover:text-primary-400',
                ].join(' ')}
              >
                {settings.protectTodoIdMarkers ? 'On' : 'Off'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-bg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text">Apply server rewrites</div>
                <div className="mt-1 text-sm text-muted">
                  The backend may normalize markdown by injecting todo markers. “Only if unchanged” avoids overwriting
                  newer typing.
                </div>
              </div>

              <select
                value={settings.applyServerRewritePolicy}
                onChange={(e) => setApplyServerRewritePolicy(e.target.value as typeof settings.applyServerRewritePolicy)}
                className="shrink-0 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text"
              >
                <option value="applyOnlyIfUnchanged">Only if unchanged (recommended)</option>
                <option value="alwaysApply">Always apply (may feel janky)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

