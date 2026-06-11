/**
 * Backfill daily, weekly and monthly aggregations for all dates with data.
 *
 * Reuses the canonical aggregation functions from src/lib/aggregations so the
 * backfill always matches production logic (Amsterdam day windows, monthly
 * from daily rows, no fabricated ACWR).
 *
 * Run with: source .env.production.local && pnpm tsx scripts/backfill-aggregations.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createAdminClient } from '../src/lib/supabase/admin'
import { reaggregateDates } from '../src/lib/aggregations/reaggregate'
import { computeMonthlyAggregation } from '../src/lib/aggregations/monthly'
import { dayKeyAmsterdam } from '../src/lib/time/amsterdam'

async function collectDates(userId: string): Promise<string[]> {
  const admin = createAdminClient()
  const days = new Set<string>()

  const timestampTables = [
    { table: 'workouts', column: 'started_at' },
    { table: 'runs', column: 'started_at' },
    { table: 'padel_sessions', column: 'started_at' },
    { table: 'walks', column: 'started_at' },
  ] as const

  for (const { table, column } of timestampTables) {
    const { data, error } = await admin
      .from(table)
      .select(column)
      .eq('user_id', userId)
    if (error) throw new Error(`${table}: ${error.message}`)
    for (const row of data ?? []) {
      const value = (row as Record<string, string | null>)[column]
      if (value) days.add(dayKeyAmsterdam(new Date(value)))
    }
  }

  const dateTables = ['daily_activity', 'sleep_logs'] as const
  for (const table of dateTables) {
    const { data, error } = await admin
      .from(table)
      .select('date')
      .eq('user_id', userId)
    if (error) throw new Error(`${table}: ${error.message}`)
    for (const row of data ?? []) {
      if (row.date) days.add(row.date)
    }
  }

  return [...days].sort()
}

async function main(): Promise<void> {
  const admin = createAdminClient()
  const { data: profiles, error } = await admin.from('profiles').select('id')
  if (error) throw new Error(`profiles: ${error.message}`)

  for (const profile of profiles ?? []) {
    const dates = await collectDates(profile.id)
    console.log(`User ${profile.id}: ${dates.length} dagen met data`)
    if (dates.length === 0) continue

    // Daily + weekly via the shared helper (chunked to keep logs readable)
    const chunkSize = 30
    for (let i = 0; i < dates.length; i += chunkSize) {
      const chunk = dates.slice(i, i + chunkSize)
      await reaggregateDates(profile.id, chunk)
      console.log(`  dagen ${i + 1}-${Math.min(i + chunkSize, dates.length)} klaar`)
    }

    // Monthly: every distinct month in the range
    const months = new Set(dates.map((d) => d.slice(0, 7)))
    for (const ym of [...months].sort()) {
      const [year, month] = ym.split('-').map(Number)
      await computeMonthlyAggregation(profile.id, month, year)
      console.log(`  maand ${ym} klaar`)
    }
  }

  console.log('Backfill compleet.')
}

main().catch((err) => {
  console.error('Backfill mislukt:', err)
  process.exit(1)
})
