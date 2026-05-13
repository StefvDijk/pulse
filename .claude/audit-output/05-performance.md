# Pulse — Performance Audit (Fase 5)

Datum: 2026-05-13  
Scope: bundle, database queries, indexes, SWR, runtime, images, RSC kandidaten

---

## 1. Bundle Analysis

### Beschikbare data

`.next/` is aanwezig (dev build, geen production `ANALYZE=true` output). Statische chunks zijn beschikbaar in `.next/static/chunks/`. Totale grootte: **1.8 MB uncompressed JS chunks** (static), **96 MB server-side** (inclusief alle Server Components en API routes — dit is normaal voor Next.js).

`@next/bundle-analyzer` is **niet geconfigureerd**. Om exacte treemap te genereren:

```js
// next.config.ts
import bundleAnalyzer from '@next/bundle-analyzer'
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })
export default withBundleAnalyzer({ /* huidige config */ })
```

Dan: `ANALYZE=true pnpm build`

### Top zware libraries (op basis van node_modules + import patterns)

| Bibliotheek | Disk (source) | Client-side? | Probleem |
|---|---|---|---|
| `googleapis` | 194 MB | Ja, indirect risico | Zit op server-only routes (calendar), maar gigantisch. Zie sectie 1.1. |
| `recharts` | 8.5 MB (source) | Ja, in 4 componenten | Geladen op progress-pagina. Geen dynamic import. |
| `lucide-react` | 29 MB (dist totaal) | Ja, 39 import-regels | Named imports — tree-shaking werkt, maar 42 unieke icons. |
| `motion` (v12) | 708 KB | Ja, in template + nav + dashboard | Elke page-transition triggert de hele motion-bundle. |
| `react-markdown` + `remark-gfm` | kleiner | Ja, in ChatMessage | Geladen als client component. |

### 1.1 googleapis — het grootste risico

**Bestand/regel:** `src/lib/google/calendar.ts:1`, `src/lib/google/oauth.ts:2`, `src/app/api/calendar/callback/route.ts:4`

`googleapis` is 194 MB ongecomprimeerd. Het wordt gebruikt voor Google Calendar OAuth en event-writes. Dit is **server-only**, maar alleen als Next.js het correct tree-shaken. Als ergens een client component deze lib indirect importeert, verschijnt het volledig in de client bundle.

**Fix:** Voeg een explicit guard toe in de importerende files:

```ts
// Bovenaan src/lib/google/calendar.ts en oauth.ts
import 'server-only'
```

Dit gooit een build-time error als de module ooit per ongeluk client-side terecht komt. Geschatte impact als het nu client-side lekt: **+500–800 KB gzipped first-load**.

### 1.2 recharts — geen dynamic import

**Bestanden:** `src/components/progress/VolumeChart.tsx`, `StrengthChart.tsx`, `RunningChart.tsx`, `src/components/nutrition/MacroSummary.tsx`

Recharts is ~200 KB gzipped. Het wordt geladen op de progress- en nutrition-pagina's. Er is geen `dynamic()` import.

**Fix:**

```ts
// In src/components/progress/ProgressPage.tsx
const VolumeChart = dynamic(() => import('./VolumeChart'), { ssr: false })
const StrengthChart = dynamic(() => import('./StrengthChart'), { ssr: false })
const RunningChart = dynamic(() => import('./RunningChart'), { ssr: false })
```

Geschatte impact: **-150 ms TTI op home/dashboard** (recharts hoeft niet geladen als je niet naar progress navigeert).

### 1.3 motion — elke pagina-transitie

**Bestand/regel:** `src/app/template.tsx:3`, `src/components/layout/Navigation.tsx:5`, `src/components/dashboard/DashboardPage.tsx:4`

`motion/react` wordt geladen in de root template — dus op elke route. 708 KB source maar goed tree-shakeable. Gezien het lichte gebruik (page transitions + nav spring), is de echte impact beperkt, maar het is wel synchrone client-bundle overhead.

**Fix:** Controleer via ANALYZE of motion in de main chunk zit. Als de app-shell chunk > 80 KB gzipped wordt, overweeg `motion` enkel in `template.tsx` te laden (is al het geval) en te verwijderen uit `DashboardPage.tsx`.

### 1.4 lucide-react — named imports zijn OK

42 unieke icons, 39 import-regels. Named imports worden correct tree-shaken door de lucide-react v1.x ESM build. Geen actie nodig, maar bewust blijven bij elke nieuwe icon-import: lucide v1.7 is groot (29 MB dist).

---

## 2. Database Query Analyse

### 2.1 Overzicht routes × query count

| Route | Queries parallel | Select * | Limit aanwezig | N+1 risico |
|---|---|---|---|---|
| `GET /api/dashboard` | 3 (Promise.all) | Ja (3x `select('*')`) | Nee (weekdata, max 7 rows) | Nee |
| `GET /api/readiness` | 5 (Promise.all) | Nee (specifieke kolommen) | Ja | Nee |
| `GET /api/workload` | 1 | Nee | Ja (date range) | Nee |
| `GET /api/workouts` | 1 (nested select) | Nee | Ja (15/page) | Nee |
| `GET /api/workouts/[id]` | 3 sequentieel | Nee | Ja | Zie 2.2 |
| `GET /api/activities` | 3 (Promise.all) | Nee | 50 hardcoded | Zie 2.3 |
| `GET /api/muscle-map` | 4 (Promise.all) | Nee | Nee (14-dagen window) | Nee |
| `GET /api/trends` | 3 (Promise.all) | Ja (2x `select('*')`) | Nee | Nee |
| `GET /api/progress` | 3 (Promise.all) | Ja (weekly + goals) | Ja (PRs: 50) | Nee |
| `GET /api/health/today` | 3 (Promise.all) | Nee | Ja (1 per table) | Nee |
| `POST /api/chat` | 5 parallel + 2 sequentieel | Nee | Ja | Zie 2.4 |
| `computeDailyAggregation` | 4 sequentieel | Nee | Nee (hele dag) | Nee |

### 2.2 `/api/workouts/[id]` — 3 sequentiële queries

**Bestand:** `src/app/api/workouts/[id]/route.ts:95-149`

```
Query 1: workout + workout_exercises + exercise_definitions + workout_sets  (1 nested)
Query 2: personal_records WHERE workout_id = $id                            (sequentieel)
Query 3: vorige workout met zelfde title (ilike)                            (sequentieel)
```

Query 2 en 3 kunnen niet parallel omdat query 3 `workout.title` nodig heeft uit query 1. Maar query 2 kan wel parallel aan query 3:

**Fix (voor query 2 + 3):**
```ts
// Na het fetchen van workout (query 1):
const [prs, prevWorkout] = await Promise.all([
  admin.from('personal_records').select('exercise_definition_id').eq('workout_id', id).eq('user_id', user.id),
  admin.from('workouts').select('id, started_at, workout_exercises(...)').eq('user_id', user.id).ilike('title', workout.title).lt('started_at', workout.started_at).order('started_at', { ascending: false }).limit(1).maybeSingle()
])
```

Geschatte impact: **-50 tot -100 ms per workout-detail paginaload** (elimineert één round-trip latency).

### 2.3 `/api/activities` — `limit(50)` per type, server-side merge

**Bestand:** `src/app/api/activities/route.ts:67-79`

De route haalt 50 workouts, 50 runs en 50 padel-sessies op, merged ze in geheugen, sorteert op datum, en pagineert daarna. Dit betekent dat bij 500 workouts in de DB altijd max 50 worden geladen — maar bij een echte merge van 3 typen kom je op 150 records die daarna gesorteerd worden in Node.

De `PAGE_SIZE = 20` suggereert dat dit ooit een echte pagineringsquery zou moeten zijn. Huidige implementatie werkt correct voor kleine datasets maar schaalt niet.

**Fix (middellange termijn):** Gebruik een `UNION ALL` query via een Supabase RPC/database view, of accepteer de huidige limiet als de dataset klein blijft (single user).

### 2.4 `/api/chat` — sequentieel session-aanmaken dan history-fetch

**Bestand:** `src/app/api/chat/route.ts:183-207`

```
Stap 1: 5 queries parallel (context)
Stap 2: [CONDITIONEEL] INSERT chat_sessions  <- alleen als geen session_id
Stap 3: SELECT chat_messages (history)       <- altijd na stap 2
```

Stap 3 kan niet parallel aan stap 2 omdat het `sessionId` nodig heeft. Dit is correct gedaan — geen fix nodig. Wel: elke chat-request doet 2 INSERTs na de stream (user message + assistant message) plus 1 UPDATE op chat_sessions. Deze zijn post-stream en blokkeren de gebruiker niet.

### 2.5 `dashboard` — `select('*')` op aggregatietabellen

**Bestand:** `src/app/api/dashboard/route.ts:57-74`

Drie `select('*')` calls op `weekly_aggregations`, `daily_aggregations`, en `training_schemas`. Deze tabellen hebben brede rijen (veel kolommen). Voor de huidige single-user setup is dit acceptabel, maar het is goede gewoonte om alleen de benodigde kolommen te selecteren.

**Fix:**
```ts
// weekly_aggregations — dashboard toont: total_sessions, total_volume_kg, workload_status, acwr
admin.from('weekly_aggregations')
  .select('week_start, total_sessions, total_volume_kg, workload_status, acute_chronic_ratio, gym_sessions, run_sessions, padel_sessions')

// daily_aggregations — dashboard toont dag-indicators
admin.from('daily_aggregations')
  .select('date, total_sessions, gym_minutes, run_minutes, padel_minutes, training_load_score')
```

Geschatte impact: **-5 tot -15 ms per dashboard-load** (minder netwerk-payload, minder serialisatie).

### 2.6 `cron/daily-aggregate` — sequentiële user-loop

**Bestand:** `src/app/api/cron/daily-aggregate/route.ts:73`

```ts
for (const { id: userId } of profiles ?? []) {
  await computeDailyAggregation(userId, yesterdayStr)  // sequentieel per user
```

Voor single-user (Stef) maakt dit niet uit. Bij meerdere users: gebruik `Promise.all(profiles.map(...))` of batching. Nu geen issue, maar noteer voor scale-up.

---

## 3. Database Indexes

### 3.1 Huidige indexes (migration 007 + latere migraties)

| Tabel | Index | Aanwezig? |
|---|---|---|
| `workouts` | `(user_id, started_at DESC)` | Ja |
| `workout_exercises` | `(workout_id)` | Ja |
| `workout_exercises` | `(exercise_definition_id)` | **NEE** |
| `workout_sets` | `(workout_exercise_id)` | Ja |
| `runs` | `(user_id, started_at DESC)` | Ja |
| `padel_sessions` | `(user_id, started_at DESC)` | Ja |
| `daily_activity` | `(user_id, date DESC)` | Ja |
| `daily_aggregations` | `(user_id, date DESC)` | Ja |
| `weekly_aggregations` | `(user_id, week_start DESC)` | Ja |
| `monthly_aggregations` | `(user_id, year DESC, month DESC)` | Ja |
| `nutrition_logs` | `(user_id, date DESC)` | Ja |
| `chat_messages` | `(user_id, created_at DESC)` | Ja |
| `chat_messages` | `(session_id, created_at ASC)` | Ja |
| `goals` | `(user_id, status)` | Ja |
| `training_schemas` | `(user_id, is_active)` | Ja |
| `personal_records` | `(user_id, exercise_definition_id, achieved_at DESC)` | Ja |
| `exercise_definitions` | `(hevy_exercise_id)` | Ja |
| `body_composition_logs` | `(user_id, date DESC)` | Ja (mig 20260403000003) |
| `coaching_memory` | `(user_id)` | Ja (mig 20260401000001) |
| `sleep_logs` | `(user_id, date DESC)` | Ja (mig 20260101000011) |
| `body_weight_logs` | `(user_id, date DESC)` | Ja (mig 20260101000011) |
| `weekly_reviews` | `(user_id, week_start DESC)` | Ja (mig 20260403000002) |
| `workouts` | `(user_id, title)` voor ilike-search | **NEE** |
| `workout_exercises` | `(exercise_definition_id)` voor JOIN | **NEE** |

### 3.2 Aanbevolen CREATE INDEX statements (copy-paste klaar)

```sql
-- 1. workout_exercises.exercise_definition_id
--    Gebruikt in alle workouts-queries die oefendetails ophalen (JOIN op exercise_definitions)
CREATE INDEX IF NOT EXISTS idx_workout_exercises_exercise_def
  ON workout_exercises(exercise_definition_id);

-- 2. workouts.title voor ilike-search in /api/workouts/[id]
--    De "previous workout" query doet: .ilike('title', workout.title)
--    Een GIN trigram index is het efficiëntst voor ILIKE
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_workouts_title_trgm
  ON workouts USING GIN (title gin_trgm_ops);

-- 3. workouts.user_id + title composite (alternatief voor trigram als pg_trgm niet beschikbaar)
CREATE INDEX IF NOT EXISTS idx_workouts_user_title
  ON workouts(user_id, title);

-- 4. personal_records.workout_id
--    In /api/workouts/[id]: SELECT WHERE workout_id = $id
CREATE INDEX IF NOT EXISTS idx_prs_workout_id
  ON personal_records(workout_id);

-- 5. injury_logs.user_id + status
--    Chat route haalt actieve blessures op: .eq('status', 'active')
CREATE INDEX IF NOT EXISTS idx_injury_logs_user_status
  ON injury_logs(user_id, status);
```

Verwachte impact van index 1: **-10 tot -30 ms** op workout-list en muscle-map queries (minder seq-scan op workout_exercises bij JOIN).
Verwachte impact van index 4: **-5 tot -20 ms** op workout-detail paginaload.

---

## 4. SWR Caching Strategy

### 4.1 Audit per hook

| Hook | Endpoint | refreshInterval | revalidateOnFocus | Oordeel |
|---|---|---|---|---|
| `useDashboardData` | `/api/dashboard` | 60.000 ms | default (true) | OK — live data |
| `useWorkload` | `/api/workload` | 300.000 ms | default (true) | OK — ACWR verandert max 1x/dag |
| `useTodayHealth` | `/api/health/today` | 300.000 ms | default (true) | OK |
| `useSchema` | `/api/schema` | 60.000 ms | default (true) | Te agressief — schema verandert zelden |
| `useTrendsData` | `/api/trends` | geen | false | OK — historische data |
| `useProgressData` | `/api/progress` | geen | false | OK |
| `useBodyComposition` | `/api/body-composition` | geen | default (true) | Verspilt refetch bij focus-switch |
| `useExerciseList` | `/api/progress/exercises` | geen | default (true) | Statische data — moet `revalidateOnFocus: false` |
| `useActivityFeed` | `/api/activities` | 0 | default (true) | OK |
| `useCoachingMemory` | `/api/coaching-memory` | geen | default (true) | Semi-statisch — zou `revalidateOnFocus: false` moeten |
| `useCheckInHistory` | `/api/check-in/history` | geen | default (true) | OK |

### 4.2 Concrete fixes

**`useSchema` — te hoge refreshInterval:**

**Bestand:** `src/hooks/useSchema.ts` (regel ~68-73)

Schema-data verandert alleen als de gebruiker via de coach een nieuw schema genereert of handmatig aanpast. `refreshInterval: 60_000` doet elke minuut een onnodige DB-query.

```ts
// Huidig:
{ refreshInterval: 60_000 }

// Fix:
{ refreshInterval: 0, revalidateOnFocus: false }
// + na schema-update: roep mutate() aan (al gedaan in sommige write-paden)
```

Geschatte impact: **-1 DB-query per minuut per open tab op schema-pagina**.

**`useExerciseList` — statische reference data:**

**Bestand:** `src/hooks/useExerciseList.ts`

`exercise_definitions` is een reference-tabel die zelden wijzigt (alleen bij sync van nieuwe Hevy exercises). SWR's `revalidateOnFocus: true` (default) triggert een refetch elke keer dat de gebruiker van tab wisselt.

```ts
// Fix:
{ revalidateOnFocus: false, dedupingInterval: 3_600_000 } // 1 uur dedup
```

**`useBodyComposition` en `useCoachingMemory`:**

Beide hebben geen expliciete SWR-opties, dus `revalidateOnFocus: true` is actief.

```ts
// Fix voor beide:
{ revalidateOnFocus: false }
```

---

## 5. Edge vs Node Runtime

### 5.1 Huidige staat

Geen enkele API route heeft `export const runtime = 'edge'`. Alle routes draaien op Node.js runtime.

### 5.2 Aanbevelingen per route

| Route | Aanbevolen runtime | Reden |
|---|---|---|
| `POST /api/chat` | Edge | AI streaming profiteert enorm van Edge (lagere TTFB, betere streaming). Heeft geen Node-specifieke APIs. Beperkende factor: `createAdminClient()` gebruikt `@supabase/supabase-js` — controleer of die Edge-compatibel is (v2 is dat). |
| `GET /api/dashboard` | Edge | Alleen DB reads, geen Node-APIs |
| `GET /api/readiness` | Edge | Alleen DB reads |
| `GET /api/workload` | Edge | Alleen DB reads + pure berekeningen |
| `GET /api/trends` | Edge | Alleen DB reads |
| `GET /api/health/today` | Edge | Alleen DB reads |
| `GET /api/workouts` | Edge | Alleen DB reads |
| `GET /api/muscle-map` | Edge | Alleen DB reads |
| `POST /api/ingest/apple-health` | Node (blijven) | Zware JSON-parsing, grote payloads, complexe transformaties |
| `GET /api/cron/*` | Node (blijven) | Complexe aggregaties, meerdere Supabase calls |
| `GET /api/calendar/*` | Node (blijven) | googleapis is Node-only |

**Chat-route is de hoogste prioriteit voor Edge.** Bij Edge-streaming is de TTFB voor het eerste AI-token typisch **50–150 ms lager** dan bij Node.js (door wegvallen van container-cold-start overhead op Vercel).

**Fix voor `/api/chat`:**
```ts
// src/app/api/chat/route.ts — bovenaan toevoegen:
export const runtime = 'edge'
// Controleer daarna: `createAdminClient` en `checkRateLimit` mogen geen Node-builtins gebruiken
```

---

## 6. Aggregaties — Cron vs On-the-fly

### 6.1 Vercel Cron Schedule

`vercel.json` bevat 3 crons:
- `0 6 * * *` — Hevy sync
- `0 2 * * *` — Daily aggregate
- `0 3 * * 1` — Weekly aggregate

### 6.2 Wordt de dashboard data echt uit de aggregatietabellen gehaald?

**Ja.** `GET /api/dashboard` leest uitsluitend uit `weekly_aggregations` en `daily_aggregations`. Er zijn geen real-time berekeningen op de dashboard-route.

**Maar:** De workload-route (`/api/workload`) berekent ACWR on-the-fly uit `daily_aggregations`. Dit is bewust — de 6 trendpunten worden berekend in Node op basis van een date-lookup Map. Dit is efficiënt genoeg (max ~60 rows geladen uit DB, O(n) berekening in geheugen).

### 6.3 Risico: cron-failure laat dashboard leeg achter

Als de daily-aggregate cron faalt (netwerk timeout, Vercel restart), toont het dashboard geen data voor die dag. Er is geen fallback naar real-time berekening.

**Aanbeveling:** Voeg in `/api/dashboard` een fallback toe: als `daily_aggregations` geen data heeft voor vandaag (nog niet geaggregeerd), roep `computeDailyAggregation` inline aan voor de huidige dag. Dit bestaat al gedeeltelijk in de cron zelf (`computeDailyAggregation(userId, todayStr)` draait naast yesterdayStr), maar de dashboard-route heeft geen fallback.

---

## 7. Image Optimization

Geen raw `<img>` tags gevonden in de codebase. `ExerciseImage.tsx` gebruikt `next/image` correct, maar met `unoptimized` prop:

**Bestand:** `src/components/shared/ExerciseImage.tsx:31`

```tsx
<Image ... unoptimized />
```

`unoptimized={true}` bypassed Next.js image optimization volledig — geen WebP-conversie, geen lazy loading via Next.js optimizer, geen automatische `srcset`. De images worden geladen van externe URLs (Hevy CDN).

**Overweging:** Als Hevy-images al geoptimaliseerd zijn (ze zijn klein, 28-36px), is `unoptimized` acceptabel. Als de images groter zijn (bv. 200x200 server-side), kost dit bandbreedte.

**Fix (laag prioriteit):** Verwijder `unoptimized`, voeg het Hevy-domein toe aan `next.config.ts`:
```ts
images: {
  remotePatterns: [{ hostname: '*.hevyapp.com' }, { hostname: 'hevy.com' }]
}
```

---

## 8. Client Components Audit

87 `'use client'` bestanden totaal. Hieronder de componenten die **geen** interactieve hooks of event-handlers gebruiken en RSC zouden kunnen zijn:

| Component | Bestand | Probleem |
|---|---|---|
| `MuscleGroupDot` | `src/components/home/MuscleGroupDot.tsx` | Pure render, geen state/handlers. `'use client'` overbodig. |
| `TodayWorkoutCard` | `src/components/home/TodayWorkoutCard.tsx` | Toont props, geen interactie. Waarschijnlijk RSC-kandidaat (afhankelijk van parent-props). |
| `WeekAtAGlance` | `src/components/home/WeekAtAGlance.tsx` | Rechterkolom met statische week-data visualisatie. |
| `ActivityCard` | `src/components/home/ActivityCard.tsx` | Pure presentatie-component. |
| `DailyHealthBar` | `src/components/home/DailyHealthBar.tsx` | Puur visueel, geen interactie. |
| `ReadinessSignal` | `src/components/home/ReadinessSignal.tsx` | Toont score, geen handlers. |
| `WorkoutFeedCard` | `src/components/home/WorkoutFeedCard.tsx` | Feed-card, lijkt puur presentationeel. |
| `AdherenceTracker` | `src/components/dashboard/AdherenceTracker.tsx` | Statische visualisatie. |
| `SportSplit` | `src/components/dashboard/SportSplit.tsx` | Percentage-bar, puur visueel. |
| `TrainingBlockIndicator` | `src/components/dashboard/TrainingBlockIndicator.tsx` | Badge-component. |
| `ChatMessage` | `src/components/chat/ChatMessage.tsx` | Rendert markdown-bericht, geen state. |

**Opmerking:** Veel van deze componenten zitten in een tree die wél client-componenten heeft (ouders met `useSWR`). In dat geval heeft het verwijderen van `'use client'` uit de leaf-componenten geen direct performance-voordeel — het child erft de client-context van de parent. Echter, als ze uit die tree worden getrokken naar een eigen Server Component subtree, is de winst **-1 client boundary** en minder JavaScript die gehydrateerd moet worden.

**Concrete actie:** Begin met `MuscleGroupDot` — het is een pure utility component en wordt ook buiten SWR-trees gebruikt (in `ExerciseImage`). Verwijder `'use client'` daar.

---

## Samenvatting: Top-10 Prioriteiten

| # | Finding | Bestand | Impact | Effort |
|---|---|---|---|---|
| 1 | `googleapis` — voeg `import 'server-only'` toe | `src/lib/google/calendar.ts`, `oauth.ts` | Voorkomt potentieel +500–800 KB bundle-leak | XS |
| 2 | `/api/chat` op Edge runtime | `src/app/api/chat/route.ts` | -50 tot -150 ms TTFB voor AI-streaming | S |
| 3 | `recharts` dynamic imports | `src/components/progress/ProgressPage.tsx` | -150 ms TTI op home | S |
| 4 | `workout_exercises(exercise_definition_id)` index | Nieuwe migratie | -10 tot -30 ms op workout/muscle-map queries | XS |
| 5 | `personal_records(workout_id)` index | Nieuwe migratie | -5 tot -20 ms op workout-detail | XS |
| 6 | `/api/workouts/[id]` — PR query parallel | `src/app/api/workouts/[id]/route.ts:95` | -50 tot -100 ms per workout-detail load | XS |
| 7 | `useSchema` — `refreshInterval: 0` | `src/hooks/useSchema.ts` | -1 onnodige DB-query per minuut | XS |
| 8 | `select('*')` vervangen op dashboard/trends | `dashboard/route.ts`, `trends/route.ts` | -5 tot -15 ms, minder payload | S |
| 9 | `useExerciseList` — `revalidateOnFocus: false` | `src/hooks/useExerciseList.ts` | Minder onnodige requests op focus | XS |
| 10 | `ExerciseImage` — verwijder `unoptimized` + whitelist Hevy domein | `src/components/shared/ExerciseImage.tsx` | Betere afbeeldingskwaliteit/bandbreedte | XS |

---

## Direct Uitvoerbare Acties (max 5)

1. **Voeg `import 'server-only'` toe** aan `src/lib/google/calendar.ts` en `src/lib/google/oauth.ts`. Dit is een 2-seconden fix die een potentieel catastrofale bundle-leak voorkomt.

2. **Maak een nieuwe migratie** met de 5 `CREATE INDEX IF NOT EXISTS` statements uit sectie 3.2. Copy-paste klaar, geen risico, directe query-snelheidswinst.

3. **Fix `/api/workouts/[id]`** om query 2 (personal_records) en query 3 (vorige workout) parallel te draaien met `Promise.all`. Zie sectie 2.2 voor de exacte code.

4. **Configureer `@next/bundle-analyzer`** en draai `ANALYZE=true pnpm build`. Dit geeft exacte chunk-attributie en valideert of `googleapis` inderdaad server-only blijft. Zonder dit zijn de bundle-schattingen educated guesses.

5. **Zet `useSchema` refreshInterval op 0** en voeg `revalidateOnFocus: false` toe aan `useExerciseList`, `useBodyComposition` en `useCoachingMemory`. Dit zijn 4 regels code die onnodige DB-load verwijderen.

---

## Open Vragen voor Stef

1. **Heeft de app ooit meerdere gebruikers gekregen?** De `cron/daily-aggregate` loopt sequentieel over alle users (lus zonder parallelisatie). Voor single-user is dit prima, maar niet schaalbaar. Moe je nu al aanpakken of later?

2. **Worden de Hevy-images cached?** `ExerciseImage` gebruikt `unoptimized` — waarschijnlijk omdat Hevy-images van een extern CDN komen. Heb je het domein (`hevyapp.com` o.i.d.) zodat we het kunnen whitelisten in `next.config.ts`?

3. **Is de `googleapis`-integratie actief in productie?** Google Calendar write-back staat in de codebase maar ik zie geen cron of prominente UI voor het. Als het niet actief is, kan de hele `googleapis` dependency verwijderd worden (bespaart 194 MB install-grootte en elimineert het bundle-risico volledig).

4. **Wil je de `/api/chat` route migreren naar Edge?** Dit is de hoogste-impact verbetering voor de AI-chatervaring, maar vereist verificatie dat `checkRateLimit` (in-memory Map) Edge-compatible is. Bij Edge-runtime per Vercel region is een in-memory rate-limiter niet betrouwbaar — je zou Upstash Redis of Vercel KV nodig hebben.

5. **Heb je Vercel Cron invocation logs?** Om te verifiëren dat de 3 crons daadwerkelijk draaien en geen silent failures hebben, controleer `Vercel Dashboard → Project → Cron Jobs`. Zijn er failed runs te zien in de afgelopen 7 dagen?
