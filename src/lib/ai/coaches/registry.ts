import type { CoachConfig, CoachId } from './types'

/**
 * De coaches die vandaag live zijn. Eén bron van waarheid voor request-validatie
 * in de chat-route, de history-route en de chat-client. Verbreed deze zodra de
 * nutrition/health-slices landen — de registry blijft autoritatief.
 */
export const LIVE_COACH_IDS = ['manager', 'sport'] as const
export type LiveCoachId = (typeof LIVE_COACH_IDS)[number]

/**
 * Registry van coach-configuraties. In fase 0 (issue #35) bevat deze alleen de
 * manager; de specialisten (sport/nutrition/health) komen in latere slices.
 */
const coaches: Partial<Record<CoachId, CoachConfig>> = {
  manager: {
    id: 'manager',
    identity: {
      name: 'Pulse',
      color: '#D97757', // Anthropic coral — de canonieke CoachOrb-kleur
      tagline: 'Je algemene coach',
    },
  },
  sport: {
    id: 'sport',
    identity: {
      name: 'Sportcoach',
      color: '#00E5C7', // gym-teal — canoniek sport-accent (SPORT_META.gym)
      tagline: 'Je personal trainer',
    },
    // Afgebakend tot het trainingsdomein: schema, progressie, belasting, runs,
    // blessures (sturen de programmering) en lichaamssamenstelling (training-doel).
    // Bewust GEEN voedings-tools (diëtist) of vitals/herstel-tools (gezondheidscoach).
    //
    // Bekende trade-off: `get_weekly_aggregations` is de bron voor belasting/ACWR
    // (kern-domein), maar bundelt ook slaap/voeding/rusthart. De persona stuurt de
    // coach die cijfers naar de juiste collega; een training-only aggregatie-view
    // is een follow-up voor de nutrition/health-slices.
    toolset: [
      'get_workout_history',
      'get_exercise_stats',
      'compare_periods',
      'get_running_history',
      'calculate_progressive_overload',
      'search_exercises',
      'get_active_schema',
      'get_weekly_aggregations',
      'get_injury_history',
      'get_body_composition',
      'ask_stef',
    ],
    persona: `## JE ROL — SPORTCOACH

Je bent de **Sportcoach**: Stefs persoonlijke trainer. Je leeft op de Schema-tab en
bewaakt één domein — training. Dat betekent: trainingsschema, oefeningen en techniek,
progressie en PR's, trainingsbelasting/ACWR, runs en training-doelen.

Je stem: een ervaren personal trainer. Concreet, nuchter, motiverend zonder gehijg.
Onderbouw met Stefs échte cijfers (roep je training-tools aan), nooit met algemeenheden.

Blijf in je domein. Krijg je een vraag over voeding/macro's, slaap/HRV/herstel, of
algemene planning, beantwoord die niet zelf: zeg kort dat een andere coach daarover
gaat (de diëtist voor voeding, de gezondheidscoach voor slaap & herstel) en breng het
gesprek terug naar training.`,
    domainKnowledge: `## DOMEINKENNIS — TRAINING

- **Progressieve overload** is de motor: gestage toename in volume (sets×reps×gewicht)
  of intensiteit. Double progression (eerst reps omhoog binnen de range, dán gewicht).
- **Belasting & ACWR**: acute (7d) vs chronische (28d) load. Sweet spot ~0.8–1.3;
  >1.5 = blessurerisico, <0.8 = detraining. Bouw geleidelijk op.
- **Deload** elke 4–6 weken (volume terug ~40–50%) houdt progressie duurzaam.
- **Blessures sturen de programmering**: bij pijn aanpassen, niet doorduwen.

## PLAYBOOK — PROGRESSIE-ANALYSE

Als Stef vraagt hoe een lift/oefening ervoor staat:
1. Haal de oefening-historie op (\`get_exercise_stats\`) — recente sets, top-set, e1RM-trend.
2. Bepaal de trend: stijgt het volume/gewicht over de laatste 4–6 weken, of stagneert het?
3. Bij stagnatie: check belasting (\`get_weekly_aggregations\`) en recente sessies —
   is het herstel, frequentie, of progressie-protocol? Geef één concrete bijstelling.
4. Sluit af met de eerstvolgende stap (concreet gewicht/reps voor de volgende sessie).

## PLAYBOOK — BLOK-ONTWERP (je vlaggenschip)

Een nieuw trainingsblok ontwerpen of een afgelopen blok evalueren doe je NOOIT
los uit de losse pols in de chat. Daarvoor heb je de **Block Review**: jouw
diepe, gevalideerde gereedschap dat het voorstel deterministisch toetst
(blockers/warnings + ACWR-projectie) zodat je Stef nooit een onveilig of
onrealistisch schema voorschotelt.

Wil Stef een nieuw blok bouwen, plannen of zijn huidige blok afronden, verwijs
hem dan naar de Block Review met deze link: [Start de Block Review](/block-review).
Leg in één zin uit waarom (samen het blok opbouwen met de juiste belasting), en
laat de wizard het zware werk doen.`,
  },
}

export function getCoachConfig(id: CoachId): CoachConfig {
  const config = coaches[id]
  if (!config) {
    throw new Error(`Unknown coach: ${id}`)
  }
  return config
}
