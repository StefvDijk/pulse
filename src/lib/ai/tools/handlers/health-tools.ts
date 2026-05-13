import { createAdminClient } from '@/lib/supabase/admin'
import { formatDayMonthWithWeekday } from '@/lib/formatters'

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function periodToDates(period: string): { start: string; end: string } {
  const now = new Date()
  const end = today()

  switch (period) {
    case 'today':
      return { start: end, end }
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

// ---------------------------------------------------------------------------
// get_health_metrics
// ---------------------------------------------------------------------------

export async function getHealthMetrics(
  userId: string,
  input: { metrics: string[]; period: string },
): Promise<string> {
  const { start, end } = periodToDates(input.period)
  const admin = createAdminClient()
  const sections: string[] = []

  // Parallel fetches for requested metrics
  const promises: Array<PromiseLike<void>> = []

  if (input.metrics.includes('sleep')) {
    promises.push(
      admin
        .from('sleep_logs')
        .select('date, total_sleep_minutes, deep_sleep_minutes, rem_sleep_minutes, sleep_efficiency')
        .eq('user_id', userId)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })
        .limit(30)
        .then(({ data }) => {
          if (!data || data.length === 0) {
            sections.push('Slaap: geen data beschikbaar')
            return
          }
          const lines = ['Slaap:']
          let totalMinutes = 0
          for (const s of data) {
            const hours = s.total_sleep_minutes ? (s.total_sleep_minutes / 60).toFixed(1) : '?'
            const deep = s.deep_sleep_minutes ? `${s.deep_sleep_minutes} min deep` : ''
            const eff = s.sleep_efficiency ? `${Number(s.sleep_efficiency).toFixed(0)}% efficiëntie` : ''
            lines.push(`  ${formatDayMonthWithWeekday(s.date, { utc: true })}: ${hours}u ${deep} ${eff}`.trim())
            totalMinutes += s.total_sleep_minutes ?? 0
          }
          const avgHours = (totalMinutes / data.length / 60).toFixed(1)
          lines.push(`  Gemiddeld: ${avgHours}u per nacht`)
          sections.push(lines.join('\n'))
        }),
    )
  }

  if (input.metrics.includes('steps') || input.metrics.includes('active_energy')) {
    promises.push(
      admin
        .from('daily_activity')
        .select('date, steps, active_calories, total_calories')
        .eq('user_id', userId)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })
        .limit(30)
        .then(({ data }) => {
          if (!data || data.length === 0) {
            sections.push('Activiteit: geen data beschikbaar')
            return
          }
          if (input.metrics.includes('steps')) {
            const lines = ['Stappen:']
            let totalSteps = 0
            for (const d of data) {
              lines.push(`  ${formatDayMonthWithWeekday(d.date, { utc: true })}: ${d.steps?.toLocaleString('nl-NL') ?? '?'} stappen`)
              totalSteps += d.steps ?? 0
            }
            lines.push(`  Gemiddeld: ${Math.round(totalSteps / data.length).toLocaleString('nl-NL')}/dag`)
            sections.push(lines.join('\n'))
          }
          if (input.metrics.includes('active_energy')) {
            const lines = ['Actieve energie:']
            for (const d of data) {
              lines.push(`  ${formatDayMonthWithWeekday(d.date, { utc: true })}: ${Math.round(Number(d.active_calories ?? 0))} kcal actief`)
            }
            sections.push(lines.join('\n'))
          }
        }),
    )
  }

  if (input.metrics.includes('resting_heart_rate') || input.metrics.includes('hrv')) {
    promises.push(
      admin
        .from('daily_activity')
        .select('date, resting_heart_rate, hrv_average')
        .eq('user_id', userId)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })
        .limit(30)
        .then(({ data }) => {
          if (!data || data.length === 0) {
            sections.push('Hartslag/HRV: geen data beschikbaar')
            return
          }
          if (input.metrics.includes('resting_heart_rate')) {
            const lines = ['Rusthart:']
            const values = data.filter((d) => d.resting_heart_rate != null)
            for (const d of values) {
              lines.push(`  ${formatDayMonthWithWeekday(d.date, { utc: true })}: ${d.resting_heart_rate} bpm`)
            }
            if (values.length > 0) {
              const avg = Math.round(values.reduce((s, d) => s + (d.resting_heart_rate ?? 0), 0) / values.length)
              lines.push(`  Gemiddeld: ${avg} bpm`)
            }
            sections.push(lines.join('\n'))
          }
          if (input.metrics.includes('hrv')) {
            const lines = ['HRV:']
            const values = data.filter((d) => d.hrv_average != null)
            for (const d of values) {
              lines.push(`  ${formatDayMonthWithWeekday(d.date, { utc: true })}: ${Number(d.hrv_average).toFixed(0)} ms`)
            }
            if (values.length > 0) {
              const avg = Math.round(values.reduce((s, d) => s + Number(d.hrv_average ?? 0), 0) / values.length)
              lines.push(`  Gemiddeld: ${avg} ms`)
            }
            sections.push(lines.join('\n'))
          }
        }),
    )
  }

  if (input.metrics.includes('weight')) {
    promises.push(
      admin
        .from('body_weight_logs')
        .select('date, weight_kg')
        .eq('user_id', userId)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })
        .limit(30)
        .then(({ data }) => {
          if (!data || data.length === 0) {
            sections.push('Gewicht: geen data beschikbaar')
            return
          }
          const lines = ['Gewicht:']
          for (const d of data) {
            lines.push(`  ${formatDayMonthWithWeekday(d.date, { utc: true })}: ${Number(d.weight_kg).toFixed(1)} kg`)
          }
          if (data.length >= 2) {
            const first = Number(data[data.length - 1].weight_kg)
            const last = Number(data[0].weight_kg)
            const delta = last - first
            lines.push(`  Trend: ${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg`)
          }
          sections.push(lines.join('\n'))
        }),
    )
  }

  await Promise.all(promises)

  if (sections.length === 0) return 'Geen gezondheidsdata beschikbaar voor deze periode.'
  return sections.join('\n\n')
}
