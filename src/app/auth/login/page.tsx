'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
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

    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0a0a0f' }}>
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold" style={{ color: '#f0f0f5' }}>Pulse</h1>
          <p className="mt-2 text-sm" style={{ color: '#8888a0' }}>Inloggen op je dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium" style={{ color: '#f0f0f5' }}>
              E-mailadres
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-colors"
              style={{
                backgroundColor: '#12121a',
                border: '1px solid #1a1a2e',
                color: '#f0f0f5',
              }}
              placeholder="stef@example.com"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium" style={{ color: '#f0f0f5' }}>
              Wachtwoord
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-colors"
              style={{
                backgroundColor: '#12121a',
                border: '1px solid #1a1a2e',
                color: '#f0f0f5',
              }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: '#f87171' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-3 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#4f8cff', color: '#ffffff' }}
          >
            {loading ? 'Inloggen...' : 'Inloggen'}
          </button>
        </form>

        <p className="text-center text-sm" style={{ color: '#8888a0' }}>
          Nog geen account?{' '}
          <Link href="/auth/signup" style={{ color: '#4f8cff' }} className="hover:underline">
            Registreren
          </Link>
        </p>
      </div>
    </div>
  )
}
