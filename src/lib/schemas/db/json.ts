import type { Json } from '@/types/database'

/**
 * Marker function that documents an intentional widen to Supabase's Json type
 * for jsonb columns. Caller is responsible for ensuring `value` is JSON-safe
 * (i.e. has been validated by a Zod schema beforehand).
 */
export function toJson<T>(value: T): Json {
  return value as unknown as Json
}
