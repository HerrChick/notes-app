import { createContext } from 'react'
import type { AuthStatus } from './authApi'

export type AuthContextValue = {
  loading: boolean
  status: AuthStatus | null
  error: string | null
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

