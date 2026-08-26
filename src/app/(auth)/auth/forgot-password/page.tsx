'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { requestPasswordRecovery } from '@/lib/auth/password-recovery'

const RECOVERY_CONFIRMATION =
  'Als er een Pulse-account voor dit e-mailadres bestaat, ontvang je een herstellink.'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)

    const supabase = createClient()
    await requestPasswordRecovery(supabase.auth, {
      email: email.trim(),
      origin: window.location.origin,
    })

    setLoading(false)
    setSubmitted(true)
  }

  return (
    <div className="bg-bg-grouped flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-text-primary text-3xl font-bold">Wachtwoord herstellen</h1>
          <p className="text-text-secondary mt-2 text-sm">
            We sturen een eenmalige herstellink naar je e-mailadres.
          </p>
        </div>

        <div className="bg-bg-surface border-bg-border rounded-[14px] border p-6">
          {submitted ? (
            <div className="space-y-4">
              <p role="status" className="text-text-primary text-sm leading-relaxed">
                {RECOVERY_CONFIRMATION}
              </p>
              <Link
                href="/auth/login"
                className="focus-ring block rounded-sm text-center text-sm font-medium text-[#0A84FF] hover:underline"
              >
                Terug naar inloggen
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  enterKeyHint="send"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="border-bg-border text-text-primary focus-ring w-full rounded-[10px] border bg-white/[0.06] px-3 py-2 text-[16px] outline-none"
                  placeholder="stef@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#0A84FF] py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              >
                {loading ? 'Versturen...' : 'Herstellink versturen'}
              </button>

              <Link
                href="/auth/login"
                className="text-text-secondary hover:text-text-primary focus-ring block rounded-sm text-center text-sm font-medium"
              >
                Terug naar inloggen
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
