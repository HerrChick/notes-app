import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  SettingsContext,
  type AppSettings,
  type SettingsContextValue,
  type TodoIdInsertionTiming,
  type ApplyServerRewritePolicy,
} from './settingsContext'

const STORAGE_KEY = 'noteTakingApp.settings.v1'

const DEFAULT_SETTINGS: AppSettings = {
  // Matches the previous behavior you liked: show marker IDs in the editor.
  showTodoIds: true,
  // Slightly longer than before to reduce mid-thought autosave churn, but still responsive.
  autosaveDebounceMs: 1000,
  todoIdInsertionTiming: 'cursorLeavesLine',
  applyServerRewritePolicy: 'applyOnlyIfUnchanged',
  protectTodoIdMarkers: true,
}

function isTodoIdInsertionTiming(v: unknown): v is TodoIdInsertionTiming {
  return v === 'cursorLeavesLine' || v === 'idleDebounce' || v === 'onBlurOrNav' || v === 'manualOnly'
}

function isApplyServerRewritePolicy(v: unknown): v is ApplyServerRewritePolicy {
  return v === 'applyOnlyIfUnchanged' || v === 'alwaysApply'
}

function readSettingsFromStorage(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<AppSettings> | null
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS

    const debounceRaw = (parsed as { autosaveDebounceMs?: unknown }).autosaveDebounceMs
    const autosaveDebounceMs =
      typeof debounceRaw === 'number' && Number.isFinite(debounceRaw)
        ? Math.max(250, Math.min(5000, Math.round(debounceRaw)))
        : DEFAULT_SETTINGS.autosaveDebounceMs

    return {
      ...DEFAULT_SETTINGS,
      ...(typeof parsed.showTodoIds === 'boolean' ? { showTodoIds: parsed.showTodoIds } : {}),
      autosaveDebounceMs,
      ...(isTodoIdInsertionTiming((parsed as { todoIdInsertionTiming?: unknown }).todoIdInsertionTiming)
        ? { todoIdInsertionTiming: (parsed as { todoIdInsertionTiming: TodoIdInsertionTiming }).todoIdInsertionTiming }
        : {}),
      ...(isApplyServerRewritePolicy((parsed as { applyServerRewritePolicy?: unknown }).applyServerRewritePolicy)
        ? {
            applyServerRewritePolicy: (parsed as { applyServerRewritePolicy: ApplyServerRewritePolicy })
              .applyServerRewritePolicy,
          }
        : {}),
      ...(typeof (parsed as { protectTodoIdMarkers?: unknown }).protectTodoIdMarkers === 'boolean'
        ? { protectTodoIdMarkers: (parsed as { protectTodoIdMarkers: boolean }).protectTodoIdMarkers }
        : {}),
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

  const setAutosaveDebounceMs = useCallback((next: number) => {
    const n = Math.max(250, Math.min(5000, Math.round(next)))
    setSettings((prev) => ({ ...prev, autosaveDebounceMs: n }))
  }, [])

  const setTodoIdInsertionTiming = useCallback((next: TodoIdInsertionTiming) => {
    setSettings((prev) => ({ ...prev, todoIdInsertionTiming: next }))
  }, [])

  const setApplyServerRewritePolicy = useCallback((next: ApplyServerRewritePolicy) => {
    setSettings((prev) => ({ ...prev, applyServerRewritePolicy: next }))
  }, [])

  const setProtectTodoIdMarkers = useCallback((next: boolean) => {
    setSettings((prev) => ({ ...prev, protectTodoIdMarkers: next }))
  }, [])

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      setShowTodoIds,
      setAutosaveDebounceMs,
      setTodoIdInsertionTiming,
      setApplyServerRewritePolicy,
      setProtectTodoIdMarkers,
    }),
    [
      settings,
      setApplyServerRewritePolicy,
      setAutosaveDebounceMs,
      setProtectTodoIdMarkers,
      setShowTodoIds,
      setTodoIdInsertionTiming,
    ],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

