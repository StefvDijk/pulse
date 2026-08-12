import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  filters: [] as Array<{ table: string; column: string; value: unknown }>,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from(table: string) {
      const dataByTable: Record<string, unknown[]> = {
        coaching_memory: [
          {
            id: '11111111-2222-3333-4444-555555555555',
            category: 'preference',
            value: 'OWN_USER_MEMORY',
          },
        ],
        coach_beliefs: [
          {
            id: '22222222-3333-4444-5555-666666666666',
            hypothesis_text: 'OWN_USER_BELIEF',
            category: 'recovery',
            confidence: 0.8,
            status: 'active',
          },
        ],
        personal_records: [
          {
            achieved_at: '2026-08-12T10:00:00Z',
            value: 100,
            unit: 'kg',
            exercise_definitions: { name: 'OWN_USER_PR' },
          },
        ],
        daily_checkins: [
          { date: '2026-08-12', feeling: 4, sleep_quality: 3, note: 'OWN_USER_CHECKIN' },
        ],
      }

      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          state.filters.push({ table, column, value })
          return query
        },
        is: () => query,
        gte: () => query,
        in: () => query,
        order: () => query,
        limit: () => query,
        then: (resolve: (value: { data: unknown[] }) => unknown) =>
          Promise.resolve(resolve({ data: dataByTable[table] ?? [] })),
      }
      return query
    },
  })),
}))

import { assembleThinContext } from '@/lib/ai/context-assembler'

describe('AI context user-data separation', () => {
  beforeEach(() => {
    state.filters.length = 0
  })

  it('scopes every context source to the authenticated user id', async () => {
    const context = await assembleThinContext('authenticated-user')

    const scopedTables = new Set(
      state.filters
        .filter((filter) => filter.column === 'user_id' && filter.value === 'authenticated-user')
        .map((filter) => filter.table),
    )

    expect(scopedTables).toEqual(
      new Set(['coaching_memory', 'coach_beliefs', 'personal_records', 'daily_checkins']),
    )
    expect(context).toContain('OWN_USER_MEMORY')
    expect(context).toContain('OWN_USER_BELIEF')
    expect(context).toContain('OWN_USER_PR')
    expect(context).toContain('OWN_USER_CHECKIN')
  })
})
