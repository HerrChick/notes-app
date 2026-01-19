import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ActionRail } from './ActionRail'
import { NotesPanel } from './NotesPanel'
import { useMediaQuery } from '../lib/useMediaQuery'

export function AppShell() {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const location = useLocation()
  const [notesOpen, setNotesOpen] = useState(false)

  // Close the drawer on navigation or when switching to desktop layout.
  useEffect(() => {
    setNotesOpen(false)
  }, [location.pathname, isDesktop])

  // Close on Escape while open.
  useEffect(() => {
    if (!notesOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotesOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [notesOpen])

  return (
    <div className="h-full overflow-hidden bg-bg text-text">
      {isDesktop ? (
        <div className="grid h-full min-h-0 grid-cols-[56px_320px_1fr]">
          <ActionRail />
          <NotesPanel />
          <main className="min-h-0 min-w-0 overflow-hidden bg-bg">
            <Outlet />
          </main>
        </div>
      ) : (
        <>
          <div className="h-full min-h-0">
            <main className="h-full min-h-0 overflow-hidden bg-bg pb-14">
              <Outlet />
            </main>
          </div>

          <div className="pointer-events-none fixed inset-0 z-40">
            <button
              type="button"
              aria-label="Close notes drawer"
              onClick={() => setNotesOpen(false)}
              className={[
                'absolute inset-x-0 bottom-14 top-0 bg-black/55 transition-opacity',
                notesOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
              ].join(' ')}
            />

            <div
              role="dialog"
              aria-modal="true"
              aria-label="Notes drawer"
              className={[
                'absolute bottom-14 left-0 top-0 w-[min(320px,86vw)] border-r border-border bg-surface shadow-2xl transition-transform',
                notesOpen ? 'pointer-events-auto translate-x-0' : 'pointer-events-none -translate-x-full',
              ].join(' ')}
            >
              <NotesPanel />
            </div>
          </div>

          <ActionRail onToggleNotes={() => setNotesOpen((v) => !v)} notesOpen={notesOpen} />
        </>
      )}
    </div>
  )
}

