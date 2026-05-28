import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { BlockReviewFormState } from '@/components/block-review/types'
import { buildCoachPersona, buildKnowledgeBase } from '@/lib/ai/coach-core'

export interface BlockReviewMessage {
  role: 'user' | 'assistant'
  content: string
}

interface BuildBlockReviewPromptParams {
  data: BlockReviewData
  form: BlockReviewFormState
  conversation: BlockReviewMessage[]
  currentProposal?: unknown
}

function formatJsonOrSkip(label: string, value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim() ? `${label}: ${value.trim()}` : ''
  if (Array.isArray(value) && value.length === 0) return ''
  if (typeof value === 'object' && Object.keys(value as Record<string, unknown>).length === 0) return ''
  return `${label}: ${JSON.stringify(value)}`
}

function buildJourneyBlock(data: BlockReviewData): string {
  const j = data.journey
  const startStr = j.journeyStart
    ? `${j.journeyStart} (${j.daysActive} dagen geleden, ~${Math.round(j.daysActive / 30.4)} maanden)`
    : 'onbekend'

  const priorSchemasLines = j.priorSchemas
    .map((s) => {
      const adh = s.adherencePct !== null ? `${s.adherencePct}%` : 's.n.b.'
      const reason = s.endReason ?? 'onbekend'
      const end = s.endDate ?? 'lopend bij vorige meting'
      return `  - ${s.title} (${s.schemaType}, ${s.weeksPlanned}w): ${s.startDate} → ${end} · ${s.sessionsCompleted}/${s.sessionsPlanned} (${adh}) · einde: ${reason}`
    })
    .join('\n')

  const liftLines = j.liftJourney
    .slice(0, 15)
    .map((l) => {
      const dPct = l.deltaPct !== null ? `${l.deltaPct >= 0 ? '+' : ''}${l.deltaPct}%` : 's.n.b.'
      return `  - ${l.exerciseName} (${l.totalSessions}× gedaan): start ${l.firstTopWeightKg}kg×${l.firstTopReps} (e1RM ${l.firstE1rm}) → nu ${l.currentTopWeightKg}kg×${l.currentTopReps} (e1RM ${l.currentE1rm}) · ${l.deltaE1rmKg >= 0 ? '+' : ''}${l.deltaE1rmKg}kg (${dPct})`
    })
    .join('\n')

  const bodyBaseline = j.bodyJourney[0]
  const bodyNow = j.bodyJourney[j.bodyJourney.length - 1]
  const bodyLine =
    bodyBaseline && bodyNow
      ? `  - Gewicht ${bodyBaseline.weightKg ?? '?'}kg → ${bodyNow.weightKg ?? '?'}kg (${j.bodyBaselineToNow.weightKgDelta !== null ? (j.bodyBaselineToNow.weightKgDelta >= 0 ? '+' : '') + j.bodyBaselineToNow.weightKgDelta + 'kg' : '?'})
  - Spiermassa ${bodyBaseline.skeletalMuscleMassKg ?? '?'}kg → ${bodyNow.skeletalMuscleMassKg ?? '?'}kg (${j.bodyBaselineToNow.skeletalMuscleMassKgDelta !== null ? (j.bodyBaselineToNow.skeletalMuscleMassKgDelta >= 0 ? '+' : '') + j.bodyBaselineToNow.skeletalMuscleMassKgDelta + 'kg' : '?'})
  - Vetmassa ${bodyBaseline.fatMassKg ?? '?'}kg → ${bodyNow.fatMassKg ?? '?'}kg (${j.bodyBaselineToNow.fatMassKgDelta !== null ? (j.bodyBaselineToNow.fatMassKgDelta >= 0 ? '+' : '') + j.bodyBaselineToNow.fatMassKgDelta + 'kg' : '?'})
  - Vet% ${bodyBaseline.fatPct ?? '?'}% → ${bodyNow.fatPct ?? '?'}% (${j.bodyBaselineToNow.fatPctDelta !== null ? (j.bodyBaselineToNow.fatPctDelta >= 0 ? '+' : '') + j.bodyBaselineToNow.fatPctDelta + '%' : '?'})
  - Buikomtrek ${bodyBaseline.waistCm ?? '?'}cm → ${bodyNow.waistCm ?? '?'}cm (${j.bodyBaselineToNow.waistCmDelta !== null ? (j.bodyBaselineToNow.waistCmDelta >= 0 ? '+' : '') + j.bodyBaselineToNow.waistCmDelta + 'cm' : '?'})`
      : '  (geen body composition data sinds start)'

  const lifetimePRsLine = j.lifetimePRs
    .slice(0, 12)
    .map((p) => `  - ${p.exercise}: ${p.value}${p.unit} (${p.recordType}, ${p.achievedAt.slice(0, 10)})`)
    .join('\n')

  const memoryLines = j.coachingMemory
    .slice(0, 20)
    .map((m) => `  - [${m.category}] ${m.value}`)
    .join('\n')

  const lessonLines = j.weeklyLessons
    .slice(0, 8)
    .map((l) => `  - ${l.weekStart} [${l.category}]: ${l.lessonText}`)
    .join('\n')

  const reviewLines = j.recentWeeklyReviews
    .map((r) => {
      const focus = r.previousFocusNote ? `focus "${r.previousFocusNote}"` : 'geen focus'
      const rating = r.previousFocusRating ? `(${r.previousFocusRating})` : ''
      return `  - ${r.weekStart}: ${focus} ${rating}`
    })
    .join('\n')

  const profile = j.userProfile
  const profileLines = profile
    ? [
        formatJsonOrSkip('  - Basics', profile.basics),
        formatJsonOrSkip('  - Barometer-oefeningen', profile.barometerExercises),
        profile.bodyCompositionNotes ? `  - Body notes: ${profile.bodyCompositionNotes}` : '',
        formatJsonOrSkip('  - Blessures (profiel)', profile.injuries),
        formatJsonOrSkip('  - Voeding-targets', profile.nutritionTargets),
        formatJsonOrSkip('  - Vaste habits', profile.recurringHabits),
        formatJsonOrSkip('  - Training-respons', profile.trainingResponse),
      ]
        .filter(Boolean)
        .join('\n')
    : '  (geen user_profile gevuld)'

  const settingsLine = [
    j.customInstructions ? `  - Custom instructies: ${j.customInstructions}` : '',
    j.proteinTargetPerKg !== null ? `  - Eiwit-target: ${j.proteinTargetPerKg}g/kg` : '',
    j.coachTone ? `  - Coach-toon: ${j.coachTone}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return `# JOURNEY (ALLES SINDS DE START)

## Tijdlijn
Start: ${startStr}
Lifetime: ${j.lifetimeTotals.totalWorkouts} workouts · ${j.lifetimeTotals.totalRuns} runs / ${j.lifetimeTotals.totalRunKm}km · ${j.lifetimeTotals.totalPadelSessions} padel · ${j.lifetimeTotals.totalTonnageKg.toLocaleString('nl-NL')}kg totaal tonnage

## Vorige schema's (chronologisch)
${priorSchemasLines || "  (geen vorige schema's gevonden)"}

## Lichaam: baseline → nu
${bodyLine}

## Key lifts: baseline → nu (top 15 op #sessies)
${liftLines || '  (geen lift-historie)'}

## Lifetime PR's (top 12 recent)
${lifetimePRsLine || "  (geen PR's)"}

## Coach-geheugen (recent, top 20)
${memoryLines || '  (geen)'}

## Weekly lessons (laatste 8)
${lessonLines || '  (geen)'}

## Recente weekly reviews
${reviewLines || '  (geen)'}

## User profile
${profileLines}

## Coach settings
${settingsLine || '  (defaults)'}
`
}

export interface BlockReviewPrompt {
  system: string
  user: string
}

export function buildBlockReviewPrompt({
  data,
  form,
  conversation,
  currentProposal,
}: BuildBlockReviewPromptParams): BlockReviewPrompt {
  // -- per-call dynamic content (varies per turn) -----------------------------
  const ratings = form.reflection.templateRatings
    .map(
      (t) =>
        `- ${t.focus}: algemeen ${t.rating ?? '—'} · volume ${t.volume ?? '—'} · intensiteit ${t.intensity ?? '—'} · motivatie ${t.motivation ?? '—'} · herstel ${t.recovery_cost ?? '—'} · tijdsdruk ${t.time_pressure ? 'ja' : 'nee'}${t.note ? ` ("${t.note}")` : ''}`,
    )
    .join('\n')

  const currentExercises = data.exerciseProgressions
    .slice(0, 20)
    .map(
      (e) =>
        `- ${e.exerciseName}: e1RM ${e.startTopE1rm ?? '?'}→${e.endTopE1rm ?? '?'}kg (${
          e.deltaE1rmKg !== null ? (e.deltaE1rmKg >= 0 ? '+' : '') + e.deltaE1rmKg : '?'
        }kg)${e.stagnant ? ' [stagnant]' : ''}`,
    )
    .join('\n')

  const body = data.bodyDelta
  const bodyLine = `Gewicht ${body.weightKg ?? '?'}kg · Spiermassa ${body.skeletalMuscleMassKg ?? '?'}kg · Vetmassa ${body.fatMassKg ?? '?'}kg · Vet% ${body.fatPct ?? '?'}%`

  const injuries = data.injuries.map((i) => `- ${i.bodyLocation} (${i.severity}, ${i.status})`).join('\n')
  const goals = data.goals
    .map((g) => `- ${g.title}${g.targetValue ? ` (target ${g.targetValue}${g.targetUnit ?? ''})` : ''}`)
    .join('\n')

  const journeyBlock = buildJourneyBlock(data)

  const ditBlokSection = `# DIT BLOK (laatste ${data.schema.weeksPlanned} weken)

## Schema
${data.schema.title} (${data.schema.schemaType}, ${data.schema.weeksPlanned} weken, ${data.schema.workoutsPerWeek}×/week)
Periode: ${data.schema.startDate} → ${data.schema.endDate}

## Adherence
${data.totals.completedSessions}/${data.totals.plannedSessions} sessies (${data.totals.adherencePct ?? '?'}%)
Gym: ${data.totals.gymSessions} · Hardloop: ${data.totals.runs}× / ${data.totals.runKm}km · Padel: ${data.totals.padelSessions}×
Tonnage: ${data.totals.totalTonnageKg.toLocaleString('nl-NL')}kg
Sport breakdown: ${JSON.stringify(data.sportBreakdown)}
ACWR: huidig ${data.currentACWR ?? '?'} · projectie zelfde volume ${data.projectedNextBlockACWR ?? '?'}

## Per workout template
${data.templateAdherence.map((t) => `- ${t.focus}: ${t.completed}/${t.planned} (${t.adherencePct ?? '?'}%)`).join('\n')}

## Spiergroepvolume per week (working sets, primary muscle)
${JSON.stringify(data.weeklyMuscleVolume)}

## Movement-pattern volume per week
${JSON.stringify(data.movementPatternVolume)}

## Sport-load trend per week
${JSON.stringify(data.sportLoadTrend)}

## Oefening-progressie (top 20 op delta)
${currentExercises || '(geen progressie-data)'}

## Lichaamsverandering dit blok
${bodyLine}

## Wellness-gemiddelde dit blok
Energie ${data.wellnessAverages.feeling ?? '?'}/5 · Slaap-kwaliteit ${data.wellnessAverages.sleepQuality ?? '?'}/5 (n=${data.wellnessAverages.checkinCount} check-ins)

## Wellness trend per week
${JSON.stringify(data.weeklyWellness)}

## Actieve blessures
${injuries || '(geen)'}

## Actieve doelen
${goals || '(geen)'}`

  const reflectieSection = `# STEFS REFLECTIE OP DIT BLOK

## Per workout
${ratings || '(geen ratings ingevuld)'}

## Behouden
${form.reflection.keepExercises.join(', ') || '(geen)'}

## Weg / vervangen
${form.reflection.dropExercises.join(', ') || '(geen)'}

## Exercise verdicts
${form.reflection.exerciseVerdicts?.length ? JSON.stringify(form.reflection.exerciseVerdicts) : '(geen)'}

## Gemiste sessies met reden
${form.reflection.missedSessions?.length ? JSON.stringify(form.reflection.missedSessions) : '(geen)'}

## Grootste win
${form.reflection.biggestWin || '(niet ingevuld)'}

## Grootste tegenvaller
${form.reflection.biggestMiss || '(niet ingevuld)'}`

  const refinementHeader = currentProposal
    ? `\n\n# HUIDIG SCHEMA-VOORSTEL\nJe zit in VERFIJN-MODUS. Pas dit schema aan op basis van Stefs laatste verzoek en/of audit. Output exact één volledig bijgewerkt schema in <block_proposal>...</block_proposal> XML tags. Geen markdown-codeblock. Geen tekst buiten de tags. Zet eventuele wijzigingsuitleg uitsluitend in coach_rationale.\n\n<current_proposal>\n${JSON.stringify(currentProposal)}\n</current_proposal>`
    : ''

  const transcript =
    conversation.length === 0
      ? '\n\n# DIT IS DE EERSTE BEURT (nog geen gesprek)\n\nReageer nu volgens de WERKWIJZE.'
      : refinementHeader +
        '\n\n# GESPREK TOT NU TOE\n\n' +
        conversation
          .map((m) => (m.role === 'assistant' ? `## Coach\n${m.content}` : `## Stef\n${m.content}`))
          .join('\n\n') +
        '\n\nReageer nu volgens de WERKWIJZE op basis van Stefs laatste antwoord.'

  // -- per-block static context (constant during this wizard session) --------
  const blessureSection = `# BLESSURE-CONSTRAINTS (ALTIJD RESPECTEREN)

Lees Stefs profiel-blessures + actieve blessures hierboven. Bovendien deze structurele regels:
- Geen overhead pressing (OHP, DB shoulder press) — schouder labrumpathologie
- Squats tot parallel, niet diep — knieën (OCD, kraakbeentransplantatie 2016)
- BSS niet na intervaltraining — minstens 1 dag ertussen
- Leg press: beperkt bereik
- RDL's met neutrale rug, initiatie vanuit heupen
- Dead bugs, Pallof press, planks altijd in schema houden — core stabiliteit
- Pull > push volume (schouder-compensatie)
- Face pulls of band pull-aparts in elke upper-dag`

  const schemaEisenSection = `# SCHEMA-EISEN VOLGEND BLOK

- Max 55 minuten per sessie (inclusief warming-up)
- Default: 4 sessies per week (ma-do), vrijdag hardlopen — tenzij Stef in het gesprek iets anders aangeeft
- Roteer ten minste 30% van de oefeningen vs vorig blok (anti-staleness, leer-stimulus)
- Deload elke 3-4 weken (verlaag volume 40-50%, of intensiteit, niet beide)
- Voor elke oefening: VERPLICHT \`sets\`, \`reps\` (range), \`rest_seconds\`, \`rpe\`, \`notes\`. Optioneel \`tempo\`.
- Voor elke sessie: VERPLICHT \`sport_type\` = gym/run/padel/rest. Voor run liefst ook \`run_type\` = easy/interval/tempo/long.
- Lever \`progression\` en \`coach_rationale\` exact volgens contract.
- start_date = eerstvolgende maandag NA de \`endDate\` uit het DIT BLOK gedeelte
- exercises moeten echte herkenbare namen zijn die Hevy kent`

  const werkwijzeSection = `# WERKWIJZE — DE DIALOOG

Je hebt twee opties elke beurt:

**Optie A: Stel vragen** als je nog niet genoeg weet voor een gefundeerd schema.
- Stel zoveel vragen als je nodig hebt. Kan 1 zijn, kan 10 zijn. Geen vast aantal.
- Maak elke vraag scherp en gericht op een keuze die het schema-ontwerp bepaalt.
- Stel GEEN vraag die je al kunt beantwoorden uit Stefs data of reflectie.
- Eindig je antwoord met EXACT deze regel: \`[NU VRAGEN]\`
- STOP daarna. Wacht op Stefs antwoord.

**Optie B: Lever het schema** zodra je genoeg weet.
- Geen vragen meer.
- Begin met CONCLUSIE + LOGICA, eindig met het \`<block_proposal>\` blok.
- Output GEEN \`[NU VRAGEN]\` in deze beurt.

**Hoe je beslist:** ga voor Optie A zolang er nog ONBEKENDE keuzes zijn waar het schema-ontwerp van afhangt. Ga voor Optie B zodra je elke kritische keuze kunt invullen met onderbouwing.

Eerste beurt (geen conversation history): begin altijd met JOURNEY-ERKENNING + ANALYSE-VAN-DIT-BLOK voordat je vragen stelt of het schema levert. Latere beurten: ga direct in op Stefs antwoord.

**VERFIJN-MODUS (geldt als er al een voorstel bestaat):** Als er al een \`<block_proposal>\` is geleverd en Stef vraagt om een aanpassing, gebruik dan ALTIJD Optie B. Verwerk de aanpassing direct in een volledig nieuw voorstel. Stel GEEN verdere vragen en vraag GEEN bevestiging. Output uitsluitend het nieuwe \`<block_proposal>\` blok. Geen tekst buiten de tags; zet korte wijzigingsuitleg in \`coach_rationale\`.

## Wanneer je het schema levert (Optie B), gebruik deze structuur

1. **CONCLUSIE** (3-5 zinnen): vat samen wat je gelaagde input nu betekent voor de aanpak.
2. **DE LOGICA** (5-8 bullets): leg het ontwerp uit — periodisatie-model, rep-range, rusttijden, progressive overload protocol, frequency + spier-volume (sets/spiergroep/week + MEV/MAV/MRV referentie), deload-timing, recovery-overwegingen, voedings-aanpak.
3. **SCHEMA-VOORSTEL** als laatste blok, exact dit format:

\`\`\`
<block_proposal>
{
  "title": "<korte naam>",
  "schema_type": "<upper_lower|push_pull_legs|full_body|custom>",
  "weeks_planned": <getal>,
  "start_date": "<YYYY-MM-DD>",
  "workout_schedule": [
    {
      "day": "monday",
      "focus": "Upper A",
      "sport_type": "gym",
      "duration_min": 55,
      "exercises": [
        {
          "name": "<exacte naam zoals in Hevy>",
          "sets": 4,
          "reps": "6-8",
          "rest_seconds": 120,
          "rpe": "8",
          "tempo": "3-1-1-0",
          "notes": "Waarom + startgewicht-suggestie in 1 zin"
        }
      ]
    }
  ],
  "progression": {
    "protocol": "double_progression",
    "deload_week": 4,
    "deload_strategy": "volume",
    "overload_increment_kg": 2.5
  },
  "coach_rationale": [
    "5-8 korte bullets met de ontwerp-logica"
  ]
}
</block_proposal>
\`\`\`

Output GEEN andere XML/JSON-blokken. Geen sycophancy. Geen lange intro's.`

  // -- compose system + user --------------------------------------------------
  const system = [
    buildCoachPersona(),
    buildKnowledgeBase(),
    blessureSection,
    schemaEisenSection,
    werkwijzeSection,
  ].join('\n\n')

  const user = [journeyBlock, ditBlokSection, reflectieSection].join('\n\n') + transcript

  return { system, user }
}
