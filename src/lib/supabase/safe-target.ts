import { z } from 'zod'

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])
const SupabaseTargetSchema = z.url()

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

  const parsed = SupabaseTargetSchema.safeParse(target)
  if (!parsed.success) {
    throw new Error(`Refusing ${operation}: Supabase URL is invalid.`)
  }

  const url = new URL(parsed.data)

  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error(
      `Refusing ${operation}: ${url.hostname} is not a local Supabase target.`,
    )
  }

  return target
}
