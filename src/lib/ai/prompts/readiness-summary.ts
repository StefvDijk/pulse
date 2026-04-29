// Prompt for generating a single Dutch sentence that summarizes today's
// readiness for Stef. Used by /api/readiness/summary, called via Haiku for
// low cost since this runs once per session per few hours.

export const READINESS_SUMMARY_SYSTEM = `Je bent Pulse Coach, Stef's AI personal trainer.

Je krijgt een snapshot van zijn readiness. Schrijf precies ÉÉN Nederlandse zin
die samenvat hoe hij ervoor staat en wat het advies is voor vandaag.

Regels:
- Exact één zin, maximaal 25 woorden.
- Noem altijd MINSTENS één concrete metric (slaap, HRV, RHR, ACWR, sessie-aantal).
- Sluit af met een handeling of observatie — geen vraag aan de gebruiker.
- Geen "goed bezig!", "top!", emoji's of uitroeptekens. Direct en feitelijk.
- Niet beginnen met "Je", "Vandaag", of "De"; varieer je openingen.
- Bij rest_day: kort, geen handeling forceren.

Voorbeelden van toon:
- "HRV ligt 12% onder gemiddeld en je hebt 4 sessies gehad — vandaag licht of een rustdag past beter."
- "ACWR 1.05 en RHR 56 bpm: prima uitgangspunt voor Upper A."
- "Geen workout gepland vandaag, geniet van je herstel of plan een easy run."

Geef UITSLUITEND de zin terug, geen labels, geen aanhalingstekens, geen extra tekst.`

interface PromptInput {
  level: 'good' | 'normal' | 'fatigued' | 'rest_day'
  todayWorkout: string | null
  acwr: number | null
  sleepMinutes: number | null
  restingHR: number | null
  hrv: number | null
  recentSessions: number
  score: number
}

function formatSleep(mins: number | null): string {
  if (mins === null) return 'onbekend'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}u${String(m).padStart(2, '0')}`
}

export function buildReadinessUserMessage(input: PromptInput): string {
  return [
    `Readiness snapshot voor vandaag:`,
    `- Level: ${input.level}`,
    `- Score: ${input.score}/100`,
    `- ACWR: ${input.acwr !== null ? input.acwr.toFixed(2) : 'onbekend'}`,
    `- Slaap: ${formatSleep(input.sleepMinutes)}`,
    `- HRV: ${input.hrv !== null ? `${input.hrv}ms` : 'onbekend'}`,
    `- RHR: ${input.restingHR !== null ? `${input.restingHR} bpm` : 'onbekend'}`,
    `- Sessies laatste 3 dagen: ${input.recentSessions}`,
    `- Workout vandaag: ${input.todayWorkout ?? 'geen — rustdag'}`,
    ``,
    `Schrijf één Nederlandse zin volgens de regels.`,
  ].join('\n')
}
