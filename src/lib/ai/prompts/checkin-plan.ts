import type { WeekConflicts } from '@/lib/google/conflicts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkoutScheduleItem {
  day: string
  focus: string
  exercises?: Array<{ name: string; sets?: number; reps?: string; notes?: string }>
  duration_min?: number
}

export interface PlanPromptParams {
  schema: {
    title: string
    workoutSchedule: Record<string, unknown> | WorkoutScheduleItem[]
    currentWeek: number
  }
  conflicts: WeekConflicts
  weekStart: string
  weekEnd: string
  previousPlan?: unknown
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSchedule(workoutSchedule: Record<string, unknown> | WorkoutScheduleItem[]): string {
  if (Array.isArray(workoutSchedule)) {
    return workoutSchedule
      .map((item) => {
        const exercises = item.exercises
          ? ` (${item.exercises.map((e) => e.name).slice(0, 4).join(', ')})`
          : ''
        const duration = item.duration_min ? ` — ${item.duration_min}min` : ''
        return `- ${item.day}: ${item.focus}${duration}${exercises}`
      })
      .join('\n')
  }

  // Object format: { days: { monday: { title, subtitle, type, duration_min } } }
  if ('days' in workoutSchedule && typeof workoutSchedule.days === 'object') {
    const days = workoutSchedule.days as Record<string, { title: string; subtitle?: string; type?: string; duration_min?: number } | null>
    return Object.entries(days)
      .filter(([, v]) => v !== null)
      .map(([day, data]) => {
        const subtitle = data!.subtitle ? ` (${data!.subtitle})` : ''
        const duration = data!.duration_min ? ` — ${data!.duration_min}min` : ''
        return `- ${day}: ${data!.title}${duration}${subtitle}`
      })
      .join('\n')
  }

  return JSON.stringify(workoutSchedule, null, 2)
}

function formatConflicts(conflicts: WeekConflicts): string {
  return conflicts.days
    .map((day) => {
      const status = day.availability === 'available'
        ? 'beschikbaar'
        : day.availability === 'morning_only'
          ? 'alleen ochtend'
          : day.availability === 'evening_only'
            ? 'alleen avond'
            : 'niet beschikbaar'

      const office = day.isOfficeDay ? ' [kantoordag]' : ''
      const reason = day.reason ? ` — ${day.reason}` : ''

      return `- ${day.dayName} (${day.date}): ${status}${office}${reason}`
    })
    .join('\n')
}

// ---------------------------------------------------------------------------
// Exported prompt builder
// ---------------------------------------------------------------------------

export function buildCheckInPlanPrompt(params: PlanPromptParams): {
  system: string
  userMessage: string
} {
  const { schema, conflicts, weekStart, weekEnd, previousPlan } = params

  const system = `Je bent Pulse Coach, Stef's persoonlijke trainer die het weekplan maakt.
Je plant trainingen voor de komende week op basis van het trainingsschema, de agenda-beschikbaarheid en een set vaste regels.

## Stijl
- Nederlands, informeel maar professioneel
- Korte, praktische redeneringen per sessie — waarom dit moment past
- Wees realistisch: als er weinig ruimte is, plan minder en benoem dat

## Trainingsregels
1. Padel is een onregelmatige losse activiteit (0–meerdere keren per week, geen vaste dag/tijd). Plan alleen padel als Stef het expliciet aangeeft of als de agenda erom vraagt — anders niet.
2. Hardlopen: streven naar ~1x per week, op een rustdag of in de avond (18:00–19:00).
3. Geen 2 zware beendagen direct na elkaar (Lower A/Lower B niet op opeenvolgende dagen).
4. Geen Bulgarian Split Squats (BSS) de dag na intervaltraining / hardlopen.
5. Gym bij voorkeur in de ochtend (06:30–07:30), zeker op kantoordagen.
6. Als een dag "niet beschikbaar" is: sla over, plan daar niks.
7. Als alleen ochtend beschikbaar is: plan gym (niet hardlopen).
8. Als alleen avond beschikbaar is: hardlopen kan, geen gym.
9. Respecteer het schema-volgorde (Upper A → Lower A → Upper B → Lower B cyclus).
10. Gym-locatie is altijd "Train More, Piet Heinkade".

## Output
Antwoord in EXACT dit JSON-formaat (geen markdown fences, puur JSON):
{
  "sessions": [
    {
      "day": "monday",
      "date": "YYYY-MM-DD",
      "workout": "Naam van workout",
      "type": "gym" | "padel" | "run",
      "time": "HH:MM",
      "endTime": "HH:MM",
      "location": "string of null",
      "reason": "Korte reden waarom dit moment past"
    }
  ],
  "reasoning": "2-4 zinnen die het totaalplaatje uitleggen: hoeveel sessies, eventuele aanpassingen, balans in de week"
}

## Regels voor output
- sessions: geordend op dag (maandag eerst, zondag laatst)
- Alleen dagen met een geplande sessie opnemen (geen "rust"-entries)
- type: "gym" voor krachttraining, "padel" voor padel, "run" voor hardlopen
- location: "Train More, Piet Heinkade" voor gym, null voor padel en hardlopen
- reason: 1 zin, max 15 woorden — waarom dit moment past
- reasoning: totaaloverzicht van de weekplanning in 2-4 zinnen`

  // Build user message
  const parts: string[] = []

  parts.push(`## Trainingsschema: ${schema.title} (week ${schema.currentWeek})`)
  parts.push(formatSchedule(schema.workoutSchedule))
  parts.push('')

  parts.push(`## Agenda-beschikbaarheid (${weekStart} t/m ${weekEnd})`)
  parts.push(formatConflicts(conflicts))
  parts.push('')

  if (previousPlan) {
    parts.push('## Vorig weekplan (ter referentie)')
    parts.push(JSON.stringify(previousPlan, null, 2))
    parts.push('')
  }

  parts.push('Maak het weekplan als JSON.')

  return { system, userMessage: parts.join('\n') }
}
