/**
 * One-time baseline backfill.
 *
 * Usage:
 *   tsx scripts/backfill-baselines.ts                # all users, today only
 *   tsx scripts/backfill-baselines.ts --days=7       # last 7 days, walking backwards
 *   tsx scripts/backfill-baselines.ts --user=<uuid>  # single user, today only
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env
 * (same as the seed scripts).
 */

import { createClient } from '@supabase/supabase-js'
import { computeBaselinesForUser } from '../src/lib/baselines/aggregate'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Parse args
function getArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const arg = process.argv.find((a) => a.startsWith(prefix))
  return arg?.slice(prefix.length)
}

const daysArg = getArg('days')
const userArg = getArg('user')

const days = daysArg ? Math.max(1, parseInt(daysArg, 10)) : 1

function daysBefore(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

async function main() {
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

  let userIds: string[]
  if (userArg) {
    userIds = [userArg]
  } else {
    const { data, error } = await supabase.from('profiles').select('id')
    if (error || !data) {
      console.error('Failed to fetch users:', error)
      process.exit(1)
    }
    userIds = data.map((r) => r.id as string)
  }

  console.log(`Backfilling baselines for ${userIds.length} user(s) over ${days} day(s)…`)

  const today = new Date().toISOString().slice(0, 10)
  let ok = 0
  let failed = 0

  for (const userId of userIds) {
    for (let i = 0; i < days; i++) {
      const date = daysBefore(today, i)
      try {
        await computeBaselinesForUser(userId, date)
        ok++
        process.stdout.write('.')
      } catch (err) {
        failed++
        console.error(`\nFailed for ${userId} @ ${date}:`, err)
      }
    }
  }

  console.log(`\nDone. ${ok} OK · ${failed} failed.`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
