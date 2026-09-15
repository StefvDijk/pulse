'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface LoginFormProps {
  initialError?: string | null
}

export function LoginForm({ initialError = null }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Full page navigation guarantees the freshly-set Supabase session cookie
    // is sent on the next request — router.push misses it intermittently.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Intentional hard navigation after auth cookie creation.
    window.location.assign('/')
  }

  return (
    <div className="bg-bg-grouped flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-text-primary text-3xl font-bold">Pulse</h1>
          <p className="text-text-secondary mt-2 text-sm">Inloggen op je dashboard</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-bg-surface border-bg-border space-y-4 rounded-[14px] border p-6"
        >
          <div className="space-y-2">
            <label htmlFor="email" className="text-text-primary block text-sm font-medium">
              E-mailadres
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              enterKeyHint="next"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-bg-border text-text-primary focus-ring w-full rounded-[10px] border bg-white/[0.06] px-3 py-2 text-[16px] outline-none"
              placeholder="stef@example.com"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="password" className="text-text-primary block text-sm font-medium">
                Wachtwoord
              </label>
              <Link
                href="/auth/forgot-password"
                className="focus-ring rounded-sm text-sm font-medium text-[#0A84FF] hover:underline"
              >
                Wachtwoord vergeten?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              enterKeyHint="go"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-bg-border text-text-primary focus-ring w-full rounded-[10px] border bg-white/[0.06] px-3 py-2 text-[16px] outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-[var(--color-status-bad)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#0A84FF] py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          >
            {loading ? 'Inloggen...' : 'Inloggen'}
          </button>
        </form>
      </div>
    </div>
  )
}
