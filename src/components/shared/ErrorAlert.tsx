'use client'

interface ErrorAlertProps {
  message?: string
  onRetry?: () => void
}

export function ErrorAlert({ message = 'Er is iets misgegaan. Probeer opnieuw.', onRetry }: ErrorAlertProps) {
  return (
    <div className="rounded-xl border border-system-red/20 bg-system-red/10 p-4 text-sm text-system-red">
      <div className="flex items-center justify-between gap-3">
        <span>{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="shrink-0 text-xs font-medium text-system-blue underline"
          >
            Opnieuw proberen
          </button>
        )}
      </div>
    </div>
  )
}
