/**
 * One-off cleanup after the check-in week-bug fix.
 *
 * Background: the previous version of `updateScheduledOverrides` in
 * src/app/api/check-in/confirm/route.ts iterated the *current* week
 * (the week being reviewed) instead of the *next* week. As a result,
 * confirming the check-in wrote `null` (forced rest) overrides for
 * scheduled gym days in the just-completed week, and never wrote any
 * overrides for the planned next week.
 *
 * This script inspects the active training_schema for a user and removes
 * any override entries for a given week range (defaults to last week:
 * Mon..Sun in Europe/Amsterdam).
 *
 * Usage:
 *   pnpm tsx scripts/cleanup-checkin-overrides.ts            # dry-run, last week
 *   pnpm tsx scripts/cleanup-checkin-overrides.ts --apply    # actually write
 *   pnpm tsx scripts/cleanup-checkin-overrides.ts --week 2026-04-27 --apply
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

for (const line of readFileSync('/Users/stef/Code/pulse/pulse/.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const apply = process.argv.includes('--apply')
const weekArgIdx = process.argv.indexOf('--week')
const userId = process.env.PULSE_USER_ID
if (!userId) throw new Error('PULSE_USER_ID env var missing')

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}

function lastMondayAmsterdam(): string {
  // Today in Europe/Amsterdam, then back up to previous Monday.
  const now = new Date()
  const ams = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }))
  const dow = ams.getDay() === 0 ? 7 : ams.getDay() // 1..7 (Mon=1)
  const thisMonday = new Date(ams)
  thisMonday.setDate(ams.getDate() - (dow - 1))
  const lastMonday = new Date(thisMonday)
  lastMonday.setDate(thisMonday.getDate() - 7)
  return lastMonday.toISOString().slice(0, 10)
}

const weekStart = weekArgIdx >= 0 ? process.argv[weekArgIdx + 1] : lastMondayAmsterdam()
const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

console.log(`User:        ${userId}`)
console.log(`Week start:  ${weekStart}`)
console.log(`Week dates:  ${weekDates.join(', ')}`)
console.log(`Mode:        ${apply ? 'APPLY' : 'DRY-RUN'}`)
console.log('')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
const { data: schema, error } = await supabase
  .from('training_schemas')
  .select('id, scheduled_overrides')
  .eq('user_id', userId)
  .eq('is_active', true)
  .single()

if (error || !schema) {
  console.error('No active training schema:', error)
  process.exit(1)
}

const overrides = (schema.scheduled_overrides ?? {}) as Record<string, string | null>
const toRemove: Record<string, string | null> = {}
for (const d of weekDates) {
  if (d in overrides) toRemove[d] = overrides[d]
}

if (Object.keys(toRemove).length === 0) {
  console.log('No overrides found for this week. Nothing to do.')
  process.exit(0)
}

console.log('Will remove these override entries:')
for (const [d, v] of Object.entries(toRemove)) {
  console.log(`  ${d}: ${v === null ? '(forced rest)' : JSON.stringify(v)}`)
}

if (!apply) {
  console.log('\nDry-run only. Re-run with --apply to write.')
  process.exit(0)
}

const cleaned: Record<string, string | null> = { ...overrides }
for (const d of weekDates) delete cleaned[d]

const { error: updateError } = await supabase
  .from('training_schemas')
  .update({ scheduled_overrides: cleaned })
  .eq('id', schema.id)

if (updateError) {
  console.error('Update failed:', updateError)
  process.exit(1)
}

console.log(`\nRemoved ${Object.keys(toRemove).length} override entries.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
