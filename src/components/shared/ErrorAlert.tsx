'use client'

interface ErrorAlertProps {
  message?: string
  onRetry?: () => void
}

export function ErrorAlert({ message = 'Er is iets misgegaan. Probeer opnieuw.', onRetry }: ErrorAlertProps) {
  return (
    <div
      className="rounded-xl p-4 text-sm"
      style={{ backgroundColor: '#2d1111', border: '1px solid #5a1a1a', color: '#fca5a5' }}
    >
      <div className="flex items-center justify-between gap-3">
        <span>{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="shrink-0 text-xs font-medium underline"
            style={{ color: '#4f8cff' }}
          >
            Opnieuw proberen
          </button>
        )}
      </div>
    </div>
  )
}
