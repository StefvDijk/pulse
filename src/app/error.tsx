'use client'

import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Uncaught error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md bg-bg-surface border border-bg-border rounded-[14px] p-6 text-center">
        <p className="mb-2 text-base font-semibold text-[var(--color-status-bad)]">
          Er is iets misgegaan
        </p>
        <p className="mb-5 text-sm text-text-secondary">
          {error.message || 'Een onverwachte fout is opgetreden.'}
        </p>
        <button
          onClick={reset}
          className="rounded-lg px-4 py-2 text-sm font-medium bg-[#0A84FF] text-white"
        >
          Opnieuw laden
        </button>
      </div>
    </div>
  )
}
