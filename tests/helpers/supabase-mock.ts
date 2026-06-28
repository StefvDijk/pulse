import { vi } from 'vitest'

export interface QueryResult {
  data: unknown
  error: unknown
}

/**
 * Chainable PostgREST query-builder mock. Every builder method returns the same
 * builder; awaiting the builder (it is thenable) or calling .maybeSingle()/.single()
 * resolves to `result`. Covers the `.from(t).select().eq().order().limit()` style
 * used across the app's route handlers.
 */
export function mockBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {}
  const chain = ['select', 'eq', 'neq', 'or', 'order', 'limit', 'delete', 'insert', 'update']
  for (const m of chain) builder[m] = vi.fn(() => builder)
  builder.maybeSingle = vi.fn(() => Promise.resolve(result))
  builder.single = vi.fn(() => Promise.resolve(result))
  // Make the builder awaitable so `await admin.from(t).select()...` resolves to result.
  builder.then = (resolve: (r: QueryResult) => unknown) => resolve(result)
  return builder
}

/** Admin client whose `.from(table)` returns a builder seeded per table name. */
export function mockAdmin(tableResults: Record<string, QueryResult>) {
  return {
    from: vi.fn((table: string) =>
      mockBuilder(tableResults[table] ?? { data: null, error: null }),
    ),
  }
}

/** Server client whose auth.getUser() resolves to the given user (or null). */
export function mockServerClient(user: { id: string } | null) {
  return {
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user }, error: null })) },
  }
}
