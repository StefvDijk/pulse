'use client'

import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Uncaught error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div
        className="w-full max-w-md rounded-xl p-6 text-center"
        style={{ backgroundColor: '#12121a', border: '1px solid #1a1a2e' }}
      >
        <p className="mb-2 text-base font-semibold" style={{ color: '#fca5a5' }}>
          Er is iets misgegaan
        </p>
        <p className="mb-5 text-sm" style={{ color: '#8888a0' }}>
          {error.message || 'Een onverwachte fout is opgetreden.'}
        </p>
        <button
          onClick={reset}
          className="rounded-lg px-4 py-2 text-sm font-medium"
          style={{ backgroundColor: '#4f8cff', color: '#fff' }}
        >
          Opnieuw laden
        </button>
      </div>
    </div>
  )
}
