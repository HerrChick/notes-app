import { createContext } from 'react'

export type AppSettings = {
  showTodoIds: boolean
}

export type SettingsContextValue = {
  settings: AppSettings
  setShowTodoIds: (next: boolean) => void
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)

