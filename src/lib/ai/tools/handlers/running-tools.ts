import { createAdminClient } from '@/lib/supabase/admin'
import { periodToDates } from '@/lib/time/periods'

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
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
    const date = formatDate(r.started_at)
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
