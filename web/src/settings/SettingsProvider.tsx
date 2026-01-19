import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { SettingsContext, type AppSettings, type SettingsContextValue } from './settingsContext'

const STORAGE_KEY = 'noteTakingApp.settings.v1'

const DEFAULT_SETTINGS: AppSettings = {
  // Matches the previous behavior you liked: show marker IDs in the editor.
  showTodoIds: true,
}

function readSettingsFromStorage(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<AppSettings> | null
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS
    return {
      ...DEFAULT_SETTINGS,
      ...(typeof parsed.showTodoIds === 'boolean' ? { showTodoIds: parsed.showTodoIds } : {}),
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function writeSettingsToStorage(settings: AppSettings) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore quota / private mode errors.
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => readSettingsFromStorage())

  useEffect(() => {
    writeSettingsToStorage(settings)
  }, [settings])

  const setShowTodoIds = useCallback((next: boolean) => {
    setSettings((prev) => ({ ...prev, showTodoIds: next }))
  }, [])

  const value = useMemo<SettingsContextValue>(() => ({ settings, setShowTodoIds }), [settings, setShowTodoIds])

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

