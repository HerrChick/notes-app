import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { login, setupAccount } from '../auth/authApi'

export function LoginRoute() {
  const navigate = useNavigate()
  const { loading, status, error, refresh } = useAuth()
  const needsSetup = status?.authenticated === false && status.needsSetup

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const title = useMemo(() => (needsSetup ? 'Create account' : 'Sign in'), [needsSetup])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      if (needsSetup) await setupAccount({ username, password })
      else await login({ username, password })
      await refresh()
      navigate('/', { replace: true })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-full items-start justify-center overflow-y-auto bg-bg px-4 py-8 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-[0_0_0_1px_rgba(168,85,247,0.12),0_24px_64px_rgba(0,0,0,0.45)]">
        <div className="mb-5">
          <div className="text-lg font-semibold text-text">{title}</div>
          <div className="text-sm text-muted">
            {needsSetup
              ? 'First run: set a username and password.'
              : 'Use your username and password.'}
          </div>
        </div>

        {loading ? <div className="text-sm text-muted">Checking status…</div> : null}
        {error ? <div className="mb-3 text-sm text-muted">{error}</div> : null}
        {formError ? (
          <div className="mb-3 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-muted">
            {formError}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <div className="mb-1 text-xs font-medium text-muted">Username</div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-600/30"
              autoComplete="username"
              required
            />
          </label>

          <label className="block">
            <div className="mb-1 text-xs font-medium text-muted">Password</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-600/30"
              type="password"
              autoComplete={needsSetup ? 'new-password' : 'current-password'}
              required
            />
          </label>

          <button
            disabled={submitting}
            className="w-full rounded-lg border border-primary-600 bg-surface-2 px-3 py-2 text-sm font-medium text-primary-400 transition hover:bg-bg disabled:opacity-60"
            type="submit"
          >
            {submitting ? 'Working…' : title}
          </button>
        </form>

        <div className="mt-4 text-xs text-muted">
          Tip: set `SESSION_SECRET` and (optionally) Turso env vars when deploying.
        </div>
      </div>
    </div>
  )
}

