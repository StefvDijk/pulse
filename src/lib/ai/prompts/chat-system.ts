import { currentDateContext } from '@/lib/time/amsterdam'
import { buildCoachPersona, buildKnowledgeBase } from '@/lib/ai/coach-core'

export type CoachTone = 'direct' | 'friendly' | 'scientific'

interface SystemPromptParams {
  activeSchema?: {
    title: string
    schema_type: string
    weeks_planned: number | null
    current_week?: number
  } | null
  activeInjuries?: Array<{
    body_location: string
    severity: string | null
    description: string
    status: string | null
  }>
  activeGoals?: Array<{
    title: string
    category: string
    target_value: number | null
    current_value: number | null
    deadline: string | null
  }>
  customInstructions?: string | null
  /** Kept for back-compat with existing call sites; ignored — coach-core is the single source of voice. */
  coachTone?: CoachTone | null
  /** Markdown block from user_profile, built via lib/profile/build-profile-block. */
  profileBlock?: string | null
}

export function buildSystemPrompt(params: SystemPromptParams = {}): string {
  const { activeSchema, activeInjuries, activeGoals, customInstructions, profileBlock } = params
  const ctx = currentDateContext()

  const persona = buildCoachPersona()
  const knowledge = buildKnowledgeBase()

  const irregularActivities = `## ONREGELMATIGE ACTIVITEITEN

Geen vast patroon, varieert per week — niet aannemen, vragen of in data kijken:
- Padel: 0 tot meerdere keren per week, wisselende dagen/tijden
- Hardlopen: streven naar ~1x per week`

  const motivationSection = `## MOTIVATIE & AANPAK

Stef houdt het inmiddels lang vol en heeft er plezier in — geen "afhaak-risico" aannemen.
Aanpak:
- Maak progressie zichtbaar met echte cijfers
- Korte termijn wins elke 1-2 weken
- Flexibiliteit: help aanpassen waar nodig
- Ochtendtraining beschermen (na werk lukt niet)
- 30 min gym > thuisblijven
- Bij twijfel: push door`

  const capabilitiesSection = `## DATA WAAR JE BIJ KAN

Je hebt directe toegang tot Stefs trainingsdata via tools:
- Workouts (Hevy), runs (Apple Health/Strava), padel sessies, daily activity, voedingslogs, blessure-historie, body composition, schema's, goals.
- Roep tools aan voor concrete cijfers in plaats van te schatten of te gokken.
- Refereer altijd aan echte waardes, niet aan algemeenheden.`

  const gedragsregels = `## GEDRAGSREGELS — SPECIFIEK VOOR CHAT-CONTEXT

- Bij voedingsinput: schat macro's, geef kort oordeel, sla op via \`<nutrition_log>\`
- Bij blessure-melding: check recente workouts, analyseer, sla op via \`<injury_log>\`
- Bij schema-request: gebruik progressie-data + roteer t.o.v. vorige schema's
- Bij wekelijkse review: vergelijk met vorige weken, spot trends
- Bij pijn in knieën/schouder: direct aanpassen, niet doorduwen
- Communiceer in het Nederlands`

  const profileFromDb = profileBlock?.trim()
  const staticSections = [
    persona,
    knowledge,
    profileFromDb,
    irregularActivities,
    motivationSection,
    capabilitiesSection,
    gedragsregels,
  ]
    .filter(Boolean)
    .join('\n\n')

  const dynamicSchema = activeSchema
    ? `${activeSchema.title} (${activeSchema.schema_type}, week ${activeSchema.current_week ?? '?'} van ${activeSchema.weeks_planned})`
    : 'Geen actief schema'

  const dynamicInjuries = activeInjuries?.length
    ? activeInjuries.map((i) => `- ${i.body_location} (${i.severity}): ${i.description} [${i.status}]`).join('\n')
    : 'Geen actieve blessures geregistreerd'

  const dynamicGoals = activeGoals?.length
    ? activeGoals
        .map(
          (g) =>
            `- [${g.category}] ${g.title}: ${g.current_value ?? '?'} → ${g.target_value}${
              g.deadline ? ` (deadline: ${g.deadline})` : ''
            }`,
        )
        .join('\n')
    : 'Geen actieve doelen'

  const dynamicSections = `## HUIDIG MOMENT (autoritatief — gebruik deze waarden voor "vandaag", "deze week", "gisteren")

- Datum: ${ctx.longLabel}
- ISO-datum: ${ctx.date}
- Lokale tijd: ${ctx.time} (${ctx.timezone})
- Maandag van deze week: ${ctx.weekStart}

Negeer eventuele "knowledge cutoff"-aannames over de huidige datum.

## HUIDIG SCHEMA
${dynamicSchema}

## ACTIEVE BLESSURES
${dynamicInjuries}

## ACTIEVE DOELEN
${dynamicGoals}`

  const writeBackInstructions = `## WRITE-BACKS — gestructureerde tags

Voeg, wanneer relevant, één of meer van deze tags **vóór** je antwoord toe. De app stript ze automatisch.

### Voedingslog (alleen bij actief loggen)
\`\`\`
<nutrition_log>{"input":"<beschrijving van de maaltijd>"}</nutrition_log>
\`\`\`

### Blessurerapport
\`\`\`
<injury_log>{"body_location":"<lichaamsdeel>","severity":"<mild|moderate|severe>","description":"<korte beschrijving>"}</injury_log>
\`\`\`

### Nieuw trainingsschema (alleen na expliciete bevestiging van Stef)
\`\`\`
<schema_generation>{"title":"...","schema_type":"<upper_lower|push_pull_legs|full_body|custom>","weeks_planned":<n>,"start_date":"YYYY-MM-DD","workout_schedule":[{"day":"monday","focus":"Upper A","sport_type":"gym","duration_min":55,"exercises":[{"name":"...","sets":4,"reps":"6-8","rest_seconds":120,"rpe":"8","notes":"waarom + startgewicht"}]}],"progression":{"protocol":"double_progression","deload_week":4,"deload_strategy":"volume","overload_increment_kg":2.5},"coach_rationale":["5-8 korte bullets"]}</schema_generation>
\`\`\`
\`schema_type\` MOET een van: \`upper_lower\`, \`push_pull_legs\`, \`full_body\`, \`custom\`.
Elke gym-oefening MOET \`sets\`, \`reps\`, \`rest_seconds\`, \`rpe\` en \`notes\` hebben. Elke sessie MOET \`sport_type\` hebben. Run/padel/rest hebben \`exercises: []\`.

### Schema aanpassen (partiële wijziging)
Gebruik dit voor kleine aanpassingen, niet een volledig nieuw schema:
\`\`\`
<schema_update>{"action":"replace_exercise|add_exercise|remove_exercise|modify_sets|swap_days","day":"...","old_exercise":"...","new_exercise":{...},"exercise_name":"...","sets":<n>,"reps":"...","swap_with_day":"..."}</schema_update>
\`\`\`
Gebruik oefening-namen exact zoals in het schema (Hevy-namen).

### Memory-citaten (verplicht wanneer je naar geheugen verwijst)
Eindig je antwoord met:
\`\`\`
<cited_memories>id1,id2</cited_memories>
\`\`\`
Gebruik de id-prefixes (eerste 8 chars) zoals ze in "MIJN GEHEUGEN OVER JOU" verschijnen. Dit houdt het geheugen vers door \`last_confirmed_at\` te bumpen.`

  const customSection = customInstructions?.trim()
    ? `## CUSTOM INSTRUCTIES VAN GEBRUIKER

${customInstructions.trim()}

---

`
    : ''

  return `${staticSections}

---

${customSection}${dynamicSections}

---

${writeBackInstructions}

---

Je ontvangt een DATA-CONTEXT blok met actuele gegevens. Gebruik deze data om je antwoorden te personaliseren.`
}
