import { createContext } from 'react'

export type TodoIdInsertionTiming = 'cursorLeavesLine' | 'idleDebounce' | 'onBlurOrNav' | 'manualOnly'
export type ApplyServerRewritePolicy = 'applyOnlyIfUnchanged' | 'alwaysApply'

export type AppSettings = {
  showTodoIds: boolean
  autosaveDebounceMs: number
  todoIdInsertionTiming: TodoIdInsertionTiming
  applyServerRewritePolicy: ApplyServerRewritePolicy
  protectTodoIdMarkers: boolean
}

export type SettingsContextValue = {
  settings: AppSettings
  setShowTodoIds: (next: boolean) => void
  setAutosaveDebounceMs: (next: number) => void
  setTodoIdInsertionTiming: (next: TodoIdInsertionTiming) => void
  setApplyServerRewritePolicy: (next: ApplyServerRewritePolicy) => void
  setProtectTodoIdMarkers: (next: boolean) => void
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)

