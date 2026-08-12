import * as Sentry from '@sentry/nextjs'

export function reportOperationalError(
  label: string,
  error: unknown,
  extra?: Record<string, unknown>,
): void {
  const exception = error instanceof Error ? error : new Error(String(error))
  Sentry.captureException(exception, {
    tags: { operation: label },
    extra,
  })
}

export function reportOperationalWarning(
  label: string,
  extra?: Record<string, unknown>,
): void {
  Sentry.captureMessage(label, {
    level: 'warning',
    tags: { operation: label },
    extra,
  })
}
