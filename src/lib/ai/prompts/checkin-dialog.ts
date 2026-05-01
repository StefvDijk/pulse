import type { CheckInReviewData } from '@/app/api/check-in/review/route'

interface DialogPromptParams {
  reviewData: CheckInReviewData
  reflection: string | null
  coachingMemory?: Array<{ key: string; category: string; value: string }>
  focusOutcome?: { rating: 'gehaald' | 'deels' | 'niet' | null; note: string } | null
}

function buildDataSnapshot(data: CheckInReviewData): string {
  const lines: string[] = []
  lines.push(`## Week ${data.week.weekNumber} (${data.week.weekStart} t/m ${data.week.weekEnd})`)

  // Schema-positie
  if (data.schemaPosition) {
    const sp = data.schemaPosition
    lines.push(`Schema: ${sp.title}${sp.weekNumber && sp.totalWeeks ? ` — week ${sp.weekNumber}/${sp.totalWeeks}` : ''}`)
  }

  // Sessies
  lines.push(`Sessies deze week: ${data.workouts.length} gym, ${data.runs.length} run, ${data.padelSessions.length} padel`)
  if (data.previousWeek?.sessionsCompleted != null) {
    lines.push(`Vorige week: ${data.previousWeek.sessionsCompleted} sessies totaal`)
  }

  // Workouts kort
  if (data.workouts.length > 0) {
    lines.push('Workouts:')
    for (const w of data.workouts) {
      const vol = w.total_volume_kg ? `${Math.round(w.total_volume_kg)}kg` : '–'
      lines.push(`  - ${w.title ?? 'workout'} (${vol})`)
    }
  }

  // Slaap — alleen als data
  if (data.sleep.avgTotalMinutes != null) {
    const h = Math.floor(data.sleep.avgTotalMinutes / 60)
    const m = Math.round(data.sleep.avgTotalMinutes % 60)
    lines.push(`Slaap: gem ${h}u${m.toString().padStart(2, '0')}`)
    if (data.previousWeek?.avgSleepMinutes != null) {
      const ph = Math.floor(data.previousWeek.avgSleepMinutes / 60)
      const pm = Math.round(data.previousWeek.avgSleepMinutes % 60)
      lines.push(`  vs vorige week: ${ph}u${pm.toString().padStart(2, '0')}`)
    }
  }

  // Voeding — alleen als data
  if (data.nutrition.avgProteinG != null || data.nutrition.avgCalories != null) {
    if (data.nutrition.avgProteinG != null) lines.push(`Eiwit: gem ${Math.round(data.nutrition.avgProteinG)}g/dag`)
    if (data.nutrition.avgCalories != null) lines.push(`Calorieën: gem ${Math.round(data.nutrition.avgCalories)}/dag`)
  }

  // Vitalen (Apple Health) — alleen als data
  if (data.vitals) {
    const v = data.vitals
    const pw = data.previousWeek
    const vitLines: string[] = []
    if (v.avgSteps != null) {
      const prev = pw?.avgSteps
      vitLines.push(`Stappen: gem ${Math.round(v.avgSteps).toLocaleString('nl-NL')}/dag${prev != null ? ` (vorige wk ${Math.round(prev).toLocaleString('nl-NL')})` : ''}`)
    }
    if (v.avgActiveCalories != null) {
      const prev = pw?.avgActiveCalories
      vitLines.push(`Actief kcal: gem ${Math.round(v.avgActiveCalories)}/dag${prev != null ? ` (vorige wk ${Math.round(prev)})` : ''}`)
    }
    if (v.avgRestingHr != null) {
      const prev = pw?.avgRestingHr
      vitLines.push(`Rust-HR: gem ${Math.round(v.avgRestingHr)}bpm${prev != null ? ` (vorige wk ${Math.round(prev)}bpm)` : ''}`)
    }
    if (v.avgHrv != null) {
      const prev = pw?.avgHrv
      vitLines.push(`HRV: gem ${Math.round(v.avgHrv)}ms${prev != null ? ` (vorige wk ${Math.round(prev)}ms)` : ''}`)
    }
    if (vitLines.length > 0) {
      lines.push('Vitalen:')
      for (const v2 of vitLines) lines.push(`  - ${v2}`)
    }
  }

  // PRs deze week
  if (data.highlights.personalRecords.length > 0) {
    lines.push('PRs deze week:')
    for (const pr of data.highlights.personalRecords) {
      const exName = (pr as { exercise_definitions?: { name: string } }).exercise_definitions?.name ?? pr.record_type
      const reps = (pr as { reps?: number | null }).reps
      lines.push(`  - ${exName}: ${pr.value}${pr.unit}${reps ? ` × ${reps}` : ''}`)
    }
  }

  return lines.join('\n')
}

export function buildCheckInDialogPrompt(params: DialogPromptParams): { system: string; userMessage: string } {
  const { reviewData, reflection, coachingMemory, focusOutcome } = params

  const system = `Je bent Pulse Coach. Je bent met Stef in een wekelijkse check-in.
Op basis van zijn data + reflectie stel je 1 tot 3 OPVALLENDE, SPECIFIEKE vragen.

## Doel
Vragen die hem aan het denken zetten of context vangen die de cijfers niet tonen.

## Stijl
- Nederlands, kort (≤15 woorden per vraag)
- Conversationeel, niet klinisch ("Ik zie dat..." / "Hoe komt het dat...")
- Refereer aan ECHTE getallen / oefeningen / dagen uit de data

## VERPLICHT
- Stel ALLEEN vragen over patronen die je ECHT in de data ziet
- Géén vragen over slaap als er geen sleep-data is
- Géén vragen over voeding als er geen nutrition-data is
- Géén vragen over stappen/RHR/HRV/active kcal als die specifieke metric ontbreekt
- Géén vragen die al beantwoord worden door zijn reflectie
- Géén generieke vragen ("hoe was de week", "voelde je je goed")

## Anomalieën waar je naar zoekt
- Sets/reps die opeens lager zijn dan vorige weken op dezelfde oefening
- Workouts die op andere dagen vallen dan het schema voorschrijft
- Sessies-aantal flink anders dan vorige week
- Een PR die opvalt — vraag wat de doorbraak was
- Slaap of eiwit-gemiddelden die merkbaar verschillen van vorige week
- Stappen die >2000/dag verschillen van vorige week
- Rust-HR die >3bpm omhoog gaat (mogelijk fatigue/ziekte)
- HRV die >5ms omlaag gaat (mogelijk stress/overtraining)
- Een focus die niet of deels gehaald is — vraag waarom
- Reflectie die iets aanstipt maar onduidelijk laat (vraag om concretie)

## Output
Antwoord ALLEEN met JSON, geen markdown fences:
{
  "questions": ["vraag 1", "vraag 2", "vraag 3"]
}

- Min 1, max 3 vragen
- Als er weinig opvalt: 1 vraag is genoeg
- Als data leeg is: 1 vraag over de reflectie of over wat er WEL gebeurde`

  const parts: string[] = []
  parts.push(buildDataSnapshot(reviewData))
  parts.push('')

  if (reviewData.previousFocus) {
    parts.push(`### Vorige focus`)
    parts.push(`Stef beloofde: "${reviewData.previousFocus.text}"`)
    if (focusOutcome?.rating) {
      const lbl = { gehaald: 'GEHAALD', deels: 'DEELS', niet: 'NIET' }[focusOutcome.rating]
      parts.push(`Eigen oordeel: ${lbl}`)
      if (focusOutcome.note.trim()) parts.push(`Toelichting: "${focusOutcome.note}"`)
    }
    parts.push('')
  }

  if (reflection?.trim()) {
    parts.push('### Reflectie van Stef (al ingevuld in stap 1)')
    parts.push(`"${reflection.trim()}"`)
    parts.push('')
  }

  if (coachingMemory && coachingMemory.length > 0) {
    parts.push('### Coaching context (achtergrond)')
    for (const m of coachingMemory.slice(0, 15)) {
      parts.push(`- [${m.category}] ${m.value}`)
    }
    parts.push('')
  }

  parts.push('Geef je vragen als JSON.')

  return { system, userMessage: parts.join('\n') }
}
