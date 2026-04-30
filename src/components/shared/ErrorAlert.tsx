'use client'

interface ErrorAlertProps {
  message?: string
  onRetry?: () => void
}

export function ErrorAlert({ message = 'Er is iets misgegaan. Probeer opnieuw.', onRetry }: ErrorAlertProps) {
  return (
    <div className="rounded-xl border border-[var(--color-status-bad)]/20 bg-[var(--color-status-bad)]/10 p-4 text-sm text-[var(--color-status-bad)]">
      <div className="flex items-center justify-between gap-3">
        <span>{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="shrink-0 text-xs font-medium text-[#0A84FF] underline"
          >
            Opnieuw proberen
          </button>
        )}
      </div>
    </div>
  )
}
