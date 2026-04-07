'use client'

import { useEffect } from 'react'

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Route error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8">
      <div className="w-full max-w-md bg-surface-primary border border-separator rounded-[14px] p-6 text-center">
        <p className="mb-2 text-base font-semibold text-system-red">
          Kan pagina niet laden
        </p>
        <p className="mb-5 text-sm text-label-secondary">
          {error.message || 'Er is een fout opgetreden bij het laden van deze pagina.'}
        </p>
        <button
          onClick={reset}
          className="rounded-lg px-4 py-2 text-sm font-medium bg-system-blue text-white"
        >
          Opnieuw laden
        </button>
      </div>
    </div>
  )
}
