'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Full page navigation guarantees the freshly-set Supabase session cookie
    // is sent on the next request — router.push misses it intermittently.
    window.location.assign('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg-grouped">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-text-primary">Pulse</h1>
          <p className="mt-2 text-sm text-text-secondary">Account aanmaken</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-bg-surface border border-bg-border rounded-[14px] p-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-text-primary">
              Naam
            </label>
            <input
              id="name"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-system-gray6 border border-bg-border text-text-primary rounded-[10px] px-3 py-2 text-sm outline-none"
              placeholder="Stef"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-text-primary">
              E-mailadres
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-system-gray6 border border-bg-border text-text-primary rounded-[10px] px-3 py-2 text-sm outline-none"
              placeholder="stef@example.com"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-text-primary">
              Wachtwoord
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-system-gray6 border border-bg-border text-text-primary rounded-[10px] px-3 py-2 text-sm outline-none"
              placeholder="Minimaal 6 tekens"
            />
          </div>

          {error && (
            <p className="text-sm text-system-red">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-3 text-sm font-semibold transition-opacity disabled:opacity-50 bg-system-blue text-white"
          >
            {loading ? 'Account aanmaken...' : 'Registreren'}
          </button>
        </form>

        <p className="text-center text-sm text-text-secondary">
          Al een account?{' '}
          <Link href="/auth/login" className="text-system-blue hover:underline">
            Inloggen
          </Link>
        </p>
      </div>
    </div>
  )
}
