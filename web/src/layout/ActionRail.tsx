import { CalendarDays, ListTodo, Search, Settings, Sparkles } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import { todayISO } from '../lib/dates'
import type { ComponentType } from 'react'
import { useEffect, useState } from 'react'
import { emitEditorInsertText, onLocalOnlyEvent } from '../lib/appEvents'

type RailItem = {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
}

const items: RailItem[] = [
  { to: `/daily/${todayISO()}`, label: 'Today', icon: CalendarDays },
  { to: `/todos`, label: 'Tasks', icon: ListTodo },
]

const secondary: RailItem[] = [
  // Placeholder actions (future LLM flows).
  { to: `/`, label: 'Search', icon: Search },
  { to: `/`, label: 'Actions', icon: Sparkles },
  { to: `/settings`, label: 'Settings', icon: Settings },
]

export function ActionRail({
  onToggleNotes,
  notesOpen,
}: {
  onToggleNotes?: () => void
  notesOpen?: boolean
}) {
  const location = useLocation()
  const [editorActive, setEditorActive] = useState(false)

  useEffect(() => {
    return onLocalOnlyEvent('editorActiveChanged', ({ active }) => setEditorActive(active))
  }, [])

  return (
    <aside className="fixed bottom-0 left-0 right-0 z-50 flex h-14 flex-row items-center gap-3 border-t border-border bg-surface px-3 md:static md:h-full md:w-[56px] md:flex-col md:gap-2 md:border-r md:border-t-0 md:px-0 md:py-3">
      <button
        type="button"
        aria-label={notesOpen ? 'Close notes' : 'Open notes'}
        onClick={onToggleNotes}
        className={clsx(
          'flex h-9 w-9 items-center justify-center rounded-lg border bg-surface-2 text-primary-400 transition md:mb-1',
          onToggleNotes ? 'cursor-pointer' : 'cursor-default',
          notesOpen ? 'border-primary-600' : 'border-border',
        )}
      >
        N
      </button>

      <div className="flex flex-1 flex-row items-center justify-center gap-3 md:flex-col md:gap-2">
        {items.map((item) => {
          const active = location.pathname === item.to || location.pathname.startsWith(item.to + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.label}
              to={item.to}
              aria-label={item.label}
              className={clsx(
                'flex h-10 w-10 items-center justify-center rounded-lg border text-muted transition',
                active
                  ? 'border-primary-600 bg-surface-2 text-primary-400 shadow-[0_0_0_1px_rgba(168,85,247,0.35)]'
                  : 'border-border bg-surface hover:border-primary-600 hover:text-primary-400',
              )}
            >
              <Icon className="h-5 w-5" />
            </Link>
          )
        })}
      </div>

      <div className="flex flex-row items-center gap-3 md:hidden">
        <button
          type="button"
          aria-label="Insert topic section"
          disabled={!editorActive}
          onClick={() => emitEditorInsertText('### \n\n---\n\n')}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-[11px] font-semibold text-muted transition hover:border-primary-600 hover:text-primary-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ###
        </button>
        <button
          type="button"
          aria-label="Insert task checkbox"
          disabled={!editorActive}
          onClick={() => emitEditorInsertText('- [ ] ')}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-sm font-semibold text-muted transition hover:border-primary-600 hover:text-primary-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ☐
        </button>
        <Link
          to="/settings"
          aria-label="Settings"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-muted transition hover:border-primary-600 hover:text-primary-400"
        >
          <Settings className="h-5 w-5" />
        </Link>
      </div>

      <div className="hidden flex-col items-center gap-2 md:flex">
        {secondary.map((item) => {
          const Icon = item.icon
          const isLink = item.to !== '/'
          return isLink ? (
            <Link
              key={item.label}
              to={item.to}
              aria-label={item.label}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-muted transition hover:border-primary-600 hover:text-primary-400"
            >
              <Icon className="h-5 w-5" />
            </Link>
          ) : (
            <button
              key={item.label}
              type="button"
              aria-label={item.label}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-muted transition hover:border-primary-600 hover:text-primary-400"
            >
              <Icon className="h-5 w-5" />
            </button>
          )
        })}
      </div>
    </aside>
  )
}

