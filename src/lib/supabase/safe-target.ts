const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

/**
 * Refuse data-mutating development operations unless their Supabase endpoint is
 * on this machine. Returning the original value lets callers validate and use
 * the exact same configuration without parsing it twice.
 */
export function assertLocalSupabaseTarget(
  target: string | undefined,
  operation: string,
): string {
  if (!target) {
    throw new Error(`Refusing ${operation}: Supabase URL is missing.`)
  }

  let url: URL
  try {
    url = new URL(target)
  } catch {
    throw new Error(`Refusing ${operation}: Supabase URL is invalid.`)
  }

  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error(
      `Refusing ${operation}: ${url.hostname} is not a local Supabase target.`,
    )
  }

  return target
}
