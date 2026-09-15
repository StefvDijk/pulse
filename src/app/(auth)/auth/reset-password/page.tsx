'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { updateRecoveredPassword } from '@/lib/auth/password-recovery'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const result = await updateRecoveredPassword(supabase.auth, {
      password,
      confirmation,
    })

    setLoading(false)
    if (!result.ok) {
      setError(result.message)
      return
    }

    setCompleted(true)
  }

  return (
    <div className="bg-bg-grouped flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-text-primary text-3xl font-bold">Nieuw wachtwoord</h1>
          <p className="text-text-secondary mt-2 text-sm">
            Kies een nieuw wachtwoord van minimaal acht tekens.
          </p>
        </div>

        <div className="bg-bg-surface border-bg-border rounded-[14px] border p-6">
          {completed ? (
            <div className="space-y-4">
              <p role="status" className="text-text-primary text-sm">
                Je wachtwoord is bijgewerkt.
              </p>
              <Link
                href="/"
                className="focus-ring block w-full rounded-lg bg-[#0A84FF] py-3 text-center text-sm font-semibold text-white"
              >
                Naar Pulse
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="new-password"
                  className="text-text-primary block text-sm font-medium"
                >
                  Nieuw wachtwoord
                </label>
                <input
                  id="new-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  enterKeyHint="next"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="border-bg-border text-text-primary focus-ring w-full rounded-[10px] border bg-white/[0.06] px-3 py-2 text-[16px] outline-none"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="confirm-password"
                  className="text-text-primary block text-sm font-medium"
                >
                  Herhaal nieuw wachtwoord
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  enterKeyHint="done"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="border-bg-border text-text-primary focus-ring w-full rounded-[10px] border bg-white/[0.06] px-3 py-2 text-[16px] outline-none"
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
                {loading ? 'Opslaan...' : 'Wachtwoord opslaan'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
