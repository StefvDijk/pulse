import type { CheckInReviewData } from '@/app/api/check-in/review/route'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ManualAddition {
  type: string
  data: Record<string, unknown>
}

interface FocusOutcomeInput {
  rating: 'gehaald' | 'deels' | 'niet' | null
  note: string
}

interface DialogTurn {
  question: string
  answer: string
}

interface CheckInAnalyzeParams {
  reviewData: CheckInReviewData
  manualAdditions?: ManualAddition[]
  coachingMemory?: Array<{ key: string; category: string; value: string }>
  reflection?: string | null
  focusOutcome?: FocusOutcomeInput | null
  dialog?: DialogTurn[]
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
      const reps = (pr as { reps?: number | null }).reps
      const repsStr = pr.record_type === 'weight' && reps ? ` × ${reps}` : ''
      lines.push(`- ${exerciseName}: ${pr.value}${pr.unit}${repsStr} (${pr.record_type})${prev}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Exported prompt builder
// ---------------------------------------------------------------------------

export function buildCheckInAnalyzePrompt(params: CheckInAnalyzeParams): { system: string; userMessage: string } {
  const { reviewData, manualAdditions, coachingMemory, reflection, focusOutcome, dialog } = params

  const system = `Je bent Pulse Coach, Stef's persoonlijke trainer.
Je geeft een wekelijkse analyse die kort, concreet, en BRUIKBAAR is.

## Stijl
- Nederlands, informeel maar professioneel
- Echte cijfers, geen vage termen ("210kg total tonnage", niet "veel")
- Geen clichés. VERBODEN: "goed bezig", "consistent getraind", "lekker gegaan", generieke complimentjes
- Heb een mening — neutrale analyse is vergetelijke analyse

## VERPLICHTE STRUCTUUR voor "summary"
Exact deze 3 onderdelen, in deze volgorde, in totaal MAX 120 woorden:

1. **Eén named win** (1 zin) — een specifieke gebeurtenis met cijfers/naam.
   Voorbeeld: "Lat Pulldown 40→45kg op donderdag — 12.5% sprong in 4 weken."
   FOUT: "Mooie progressie deze week."

2. **Eén named risk of obstacle** (1 zin) — wat moet aandacht.
   Voorbeeld: "Slaap zakte naar 6u14m gemiddeld — 3 nachten <6u, dat is je laagste maand sinds maart."
   FOUT: "Let op je herstel."

3. **1-3 zinnen pattern** — verbinding met vorige weken via memory of focus-outcome.
   Refereer expliciet als er een previousFocus + outcome is.

## "keyInsights"
2-3 bullets, elk een concrete observatie met cijfers. Geen herhaling van summary.

## "focusNextWeek"
Eén zin, max 15 woorden, formaat: actie + meetbaar resultaat.
Voorbeeld: "3 nachten ≥7u30m slaap door om 22:30 in bed."
FOUT: "Beter slapen."

## Output
Antwoord in EXACT dit JSON-formaat (geen markdown fences, puur JSON):
{
  "summary": "Win-zin. Risk-zin. Pattern-zinnen.",
  "keyInsights": ["inzicht 1", "inzicht 2"],
  "focusNextWeek": "Actie + meetbaar resultaat"
}

## Hard rules
- summary ≤120 woorden TOTAAL
- Als data dun is: zeg dat in 1 zin en analyseer wat er WEL is
- Coaching memory + previousFocus zijn signalen — als ze er zijn, gebruik ze
- **NOOIT spreken over slaap als er geen sleep-data is**. Geen "ik weet niet hoe je sliep", geen "log je slaap". Sla het thema gewoon over.
- **NOOIT spreken over voeding als er geen nutrition-data is**. Zelfde regel: zwijg, vraag niet naar logging.
- **NOOIT spreken over stappen/RHR/HRV/active kcal als die specifieke metric ontbreekt**. Dezelfde zwijg-regel.
- Refereer alleen aan metrics die ECHT in de data staan.`

  // Build user message
  const parts: string[] = []

  parts.push(buildDataBlock(reviewData))

  // Schema-positie context
  if (reviewData.schemaPosition) {
    const sp = reviewData.schemaPosition
    parts.push('### Schema-positie')
    parts.push(`Actief schema: ${sp.title}${sp.weekNumber && sp.totalWeeks ? ` — week ${sp.weekNumber} van ${sp.totalWeeks}` : sp.weekNumber ? ` — week ${sp.weekNumber}` : ''}`)
    parts.push('')
  }

  // Week-vs-previous comparison
  if (reviewData.previousWeek) {
    const pw = reviewData.previousWeek
    const lines: string[] = []
    if (pw.sessionsCompleted != null) lines.push(`- Sessies: ${pw.sessionsCompleted}`)
    if (pw.avgProteinG != null) lines.push(`- Eiwit/dag: ${Math.round(pw.avgProteinG)}g`)
    if (pw.avgSleepMinutes != null) lines.push(`- Slaap: ${Math.floor(pw.avgSleepMinutes / 60)}u${Math.round(pw.avgSleepMinutes % 60)}m`)
    if (pw.avgSteps != null) lines.push(`- Stappen/dag: ${Math.round(pw.avgSteps).toLocaleString('nl-NL')}`)
    if (pw.avgRestingHr != null) lines.push(`- Rust-HR: ${Math.round(pw.avgRestingHr)}bpm`)
    if (pw.avgHrv != null) lines.push(`- HRV: ${Math.round(pw.avgHrv)}ms`)
    if (pw.avgActiveCalories != null) lines.push(`- Actief kcal: ${Math.round(pw.avgActiveCalories)}`)
    if (lines.length > 0) {
      parts.push('### Vorige week (ter vergelijking)')
      parts.push(...lines)
      parts.push('')
    }
  }

  // Vitalen deze week
  if (reviewData.vitals) {
    const v = reviewData.vitals
    const lines: string[] = []
    if (v.avgSteps != null) lines.push(`- Stappen/dag: ${Math.round(v.avgSteps).toLocaleString('nl-NL')}`)
    if (v.avgActiveCalories != null) lines.push(`- Actief kcal/dag: ${Math.round(v.avgActiveCalories)}`)
    if (v.avgRestingHr != null) lines.push(`- Rust-HR: ${Math.round(v.avgRestingHr)}bpm`)
    if (v.avgHrv != null) lines.push(`- HRV: ${Math.round(v.avgHrv)}ms`)
    if (lines.length > 0) {
      parts.push('### Vitalen deze week (Apple Health)')
      parts.push(...lines)
      parts.push('')
    }
  }

  // Vorige focus + outcome (continuïteit)
  if (reviewData.previousFocus) {
    parts.push('### Vorige week focus')
    parts.push(`Stef beloofde zichzelf: "${reviewData.previousFocus.text}"`)
    if (focusOutcome?.rating) {
      const ratingLabel = { gehaald: 'GEHAALD', deels: 'DEELS GEHAALD', niet: 'NIET GEHAALD' }[focusOutcome.rating]
      parts.push(`Eigen oordeel: ${ratingLabel}`)
      if (focusOutcome.note.trim()) parts.push(`Toelichting: "${focusOutcome.note}"`)
    }
    parts.push('Verwerk dit expliciet in je analyse — refereer naar het al-dan-niet behalen van de focus.')
    parts.push('')
  }

  // Free-text reflection van Stef (verplicht in stap 1, ≥10 chars)
  if (reflection && reflection.trim()) {
    parts.push('### Reflectie van Stef')
    parts.push(`"${reflection.trim()}"`)
    parts.push('')
  }

  // Coach-vragen + Stef's antwoorden (uit conversational stap 2)
  if (dialog && dialog.length > 0) {
    parts.push('### Gesprek met de coach (jij stelde, Stef antwoordde)')
    for (const turn of dialog) {
      parts.push(`Q: ${turn.question}`)
      parts.push(`A: ${turn.answer || '(geen antwoord)'}`)
    }
    parts.push('Verwerk deze antwoorden expliciet in de analyse.')
    parts.push('')
  }

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
