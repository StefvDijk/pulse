import type { CheckInReviewData } from '@/types/check-in'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ManualAddition {
  type: string
  data: Record<string, unknown>
}

interface CheckInAnalyzeParams {
  reviewData: CheckInReviewData
  manualAdditions?: ManualAddition[]
  coachingMemory?: Array<{ key: string; category: string; value: string }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMinutes(totalMinutes: number | null): string {
  if (totalMinutes === null) return '–'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.round(totalMinutes % 60)
  return hours > 0 ? `${hours}u${minutes.toString().padStart(2, '0')}m` : `${minutes}m`
}

function formatPace(secondsPerKm: number | null): string {
  if (secondsPerKm === null) return '–'
  const min = Math.floor(secondsPerKm / 60)
  const sec = Math.round(secondsPerKm % 60)
  return `${min}:${sec.toString().padStart(2, '0')}/km`
}

// ---------------------------------------------------------------------------
// Build data summary for the AI
// ---------------------------------------------------------------------------

function buildDataBlock(data: CheckInReviewData): string {
  const { week, sessions, workouts, runs, padelSessions, nutrition, sleep, highlights, aggregation } = data

  const lines: string[] = []

  lines.push(`## Week ${week.weekNumber} (${week.weekStart} t/m ${week.weekEnd})`)
  lines.push('')

  // Sessions overview
  lines.push('### Sessies')
  lines.push(`- Gepland: ${sessions.planned ?? '–'}`)
  lines.push(`- Voltooid: ${sessions.completed ?? '–'}`)
  lines.push(`- Adherence: ${sessions.adherencePercentage != null ? `${Math.round(sessions.adherencePercentage)}%` : '–'}`)
  lines.push('')

  // Workouts
  if (workouts.length > 0) {
    lines.push('### Gym workouts')
    for (const w of workouts) {
      const dur = w.duration_seconds ? formatMinutes(w.duration_seconds / 60) : '–'
      const vol = w.total_volume_kg ? `${Math.round(w.total_volume_kg)}kg` : '–'
      lines.push(`- ${w.title} | ${dur} | volume: ${vol} | sets: ${w.set_count ?? '–'} | PRs: ${w.pr_count ?? 0}`)
    }
    lines.push('')
  }

  // Runs
  if (runs.length > 0) {
    lines.push('### Runs')
    for (const r of runs) {
      const km = (r.distance_meters / 1000).toFixed(1)
      const dur = formatMinutes(r.duration_seconds / 60)
      const pace = formatPace(r.avg_pace_seconds_per_km)
      lines.push(`- ${r.run_type ?? 'run'} | ${km}km | ${dur} | pace: ${pace}`)
    }
    lines.push('')
  }

  // Padel
  if (padelSessions.length > 0) {
    lines.push('### Padel')
    for (const p of padelSessions) {
      const dur = formatMinutes(p.duration_seconds / 60)
      lines.push(`- ${p.session_type ?? 'sessie'} | ${dur} | ${p.calories_burned ?? '–'} kcal`)
    }
    lines.push('')
  }

  // Tonnage & load
  if (aggregation) {
    lines.push('### Weekvolume')
    lines.push(`- Totale tonnage: ${aggregation.total_tonnage_kg ? `${Math.round(aggregation.total_tonnage_kg)}kg` : '–'}`)
    lines.push(`- Training load score: ${aggregation.week_training_load_total ?? '–'}`)
    lines.push(`- A:C ratio: ${aggregation.acute_chronic_ratio != null ? aggregation.acute_chronic_ratio.toFixed(2) : '–'}`)
    lines.push(`- Workload status: ${aggregation.workload_status ?? '–'}`)
    lines.push(`- Trainingsminuten totaal: ${aggregation.total_training_minutes ?? '–'}`)
    lines.push('')
  }

  // Nutrition
  lines.push('### Voeding (gemiddeld)')
  lines.push(`- Calorieën: ${nutrition.avgCalories != null ? `${Math.round(nutrition.avgCalories)} kcal` : '–'} (${nutrition.days.length} dagen gelogd)`)
  lines.push(`- Eiwit: ${nutrition.avgProteinG != null ? `${Math.round(nutrition.avgProteinG)}g` : '–'}`)
  lines.push('')

  // Sleep
  lines.push('### Slaap (gemiddeld)')
  lines.push(`- Totaal: ${formatMinutes(sleep.avgTotalMinutes)} (${sleep.days.length} nachten gelogd)`)
  lines.push(`- Deep sleep: ${formatMinutes(sleep.avgDeepMinutes)}`)
  lines.push('')

  // Highlights / PRs
  if (highlights.personalRecords.length > 0) {
    lines.push('### PRs deze week')
    for (const pr of highlights.personalRecords) {
      const exerciseName = (pr as Record<string, unknown>).exercise_definitions
        ? ((pr as Record<string, unknown>).exercise_definitions as Record<string, string>).name
        : pr.record_category
      const prev = pr.previous_record != null ? ` (was: ${pr.previous_record}${pr.unit})` : ''
      lines.push(`- ${exerciseName}: ${pr.value}${pr.unit} (${pr.record_type})${prev}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Exported prompt builder
// ---------------------------------------------------------------------------

export function buildCheckInAnalyzePrompt(params: CheckInAnalyzeParams): { system: string; userMessage: string } {
  const { reviewData, manualAdditions, coachingMemory } = params

  const system = `Je bent Pulse Coach, Stef's persoonlijke trainer en coach.
Je analyseert zijn wekelijkse check-in data en geeft een beknopte, eerlijke samenvatting.

## Stijl
- Nederlands, informeel maar professioneel
- Direct en eerlijk — benoem wat goed ging en wat beter kan
- Gebruik echte getallen uit de data, niet vage termen
- Geen clichés, geen "goed bezig!" tenzij het echt uitstekend was
- Kort en puntig — dit is een samenvatting, geen essay

## Output
Antwoord in EXACT dit JSON-formaat (geen markdown fences, puur JSON):
{
  "summary": "3-5 zinnen die de week samenvatten. Benoem concrete cijfers.",
  "keyInsights": ["inzicht 1", "inzicht 2", "inzicht 3"],
  "focusNextWeek": "Eén concreet actiepunt voor volgende week"
}

## Regels
- summary: 3-5 zinnen, refereer naar echte getallen (tonnage, km, adherence %, slaapuren)
- keyInsights: 2-4 bullets, mix van positief en constructief
- focusNextWeek: Eén specifieke, haalbare tip — geen vage adviezen
- Als er weinig data is, benoem dat eerlijk en baseer je op wat er WEL is
- Houd rekening met de context uit coaching memory als die er is`

  // Build user message
  const parts: string[] = []

  parts.push(buildDataBlock(reviewData))

  // Add coaching memory context
  if (coachingMemory && coachingMemory.length > 0) {
    parts.push('### Coaching context (onthouden feiten)')
    for (const m of coachingMemory) {
      parts.push(`- [${m.category}] ${m.key}: ${m.value}`)
    }
    parts.push('')
  }

  // Add manual additions
  if (manualAdditions && manualAdditions.length > 0) {
    parts.push('### Handmatige toevoegingen van Stef')
    for (const addition of manualAdditions) {
      parts.push(`- Type: ${addition.type}`)
      parts.push(`  Data: ${JSON.stringify(addition.data)}`)
    }
    parts.push('')
  }

  parts.push('Geef je analyse als JSON.')

  return { system, userMessage: parts.join('\n') }
}
