import { createAdminClient } from '@/lib/supabase/admin'
import { formatDayMonthWithWeekday } from '@/lib/formatters'

// ---------------------------------------------------------------------------
// Date helpers (shared logic — keep DRY with workout-tools)
// ---------------------------------------------------------------------------

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function periodToDates(period: string): { start: string; end: string } {
  const now = new Date()
  const end = today()

  switch (period) {
    case 'this_week': {
      const day = now.getUTCDay()
      const diff = day === 0 ? 6 : day - 1
      const start = new Date(now)
      start.setUTCDate(now.getUTCDate() - diff)
      return { start: start.toISOString().slice(0, 10), end }
    }
    case 'last_week': {
      const day = now.getUTCDay()
      const diff = day === 0 ? 6 : day - 1
      const thisMonday = new Date(now)
      thisMonday.setUTCDate(now.getUTCDate() - diff)
      const lastMonday = new Date(thisMonday)
      lastMonday.setUTCDate(thisMonday.getUTCDate() - 7)
      const lastSunday = new Date(thisMonday)
      lastSunday.setUTCDate(thisMonday.getUTCDate() - 1)
      return { start: lastMonday.toISOString().slice(0, 10), end: lastSunday.toISOString().slice(0, 10) }
    }
    case 'this_month': {
      const start = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1)
      return { start: start.toISOString().slice(0, 10), end }
    }
    case 'last_month': {
      const start = new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
      const endDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), 0)
      return { start: start.toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10) }
    }
    case 'last_3_months': {
      const start = new Date(now)
      start.setUTCDate(now.getUTCDate() - 90)
      return { start: start.toISOString().slice(0, 10), end }
    }
    default:
      return { start: end, end }
  }
}

function formatPace(secondsPerKm: number): string {
  const mins = Math.floor(secondsPerKm / 60)
  const secs = Math.round(secondsPerKm % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}/km`
}

// ---------------------------------------------------------------------------
// get_running_history
// ---------------------------------------------------------------------------

export async function getRunningHistory(
  userId: string,
  input: { period: string; run_type: string },
): Promise<string> {
  const { start, end } = periodToDates(input.period)
  const admin = createAdminClient()

  let query = admin
    .from('runs')
    .select('started_at, duration_seconds, distance_meters, avg_pace_seconds_per_km, avg_heart_rate, max_heart_rate, calories_burned, run_type, notes')
    .eq('user_id', userId)
    .gte('started_at', `${start}T00:00:00`)
    .lte('started_at', `${end}T23:59:59`)
    .order('started_at', { ascending: false })
    .limit(30)

  if (input.run_type !== 'all') {
    query = query.eq('run_type', input.run_type)
  }

  const { data: runs, error } = await query

  if (error) return `Fout bij ophalen runs: ${error.message}`
  if (!runs || runs.length === 0) return `Geen runs gevonden in periode ${start} t/m ${end}.`

  let totalDistance = 0
  let totalDuration = 0

  const lines: string[] = [`${runs.length} runs gevonden (${start} t/m ${end}):\n`]

  for (const r of runs) {
    const date = formatDayMonthWithWeekday(r.started_at)
    const km = r.distance_meters ? (Number(r.distance_meters) / 1000).toFixed(1) : '?'
    const mins = r.duration_seconds ? Math.round(r.duration_seconds / 60) : '?'
    const pace = r.avg_pace_seconds_per_km ? formatPace(r.avg_pace_seconds_per_km) : '?'
    const hr = r.avg_heart_rate ? `HR gem ${r.avg_heart_rate}` : ''
    const type = r.run_type ?? 'onbekend'
    const note = r.notes ? ` [${r.notes}]` : ''

    totalDistance += Number(r.distance_meters ?? 0)
    totalDuration += r.duration_seconds ?? 0

    lines.push(`${date}: ${km} km ${type} run in ${mins} min (${pace}, ${hr})${note}`)
  }

  lines.push(`\nTotaal: ${(totalDistance / 1000).toFixed(1)} km in ${Math.round(totalDuration / 60)} min`)

  return lines.join('\n')
}
