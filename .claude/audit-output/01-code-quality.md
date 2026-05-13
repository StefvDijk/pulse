# Pulse — Code Quality Audit
**Datum:** 2026-05-13
**Scope:** src/**/*.ts, src/**/*.tsx — exclusief src/types/database.ts en *.test.*

---

## Sectie 1: Executive Summary

| Severity | Aantal |
|----------|--------|
| P0       | 1      |
| P1       | 5      |
| P2       | 9      |
| P3       | 5      |

**Totaaloordeel:** De codebase is functioneel en bevat goede structurerende keuzes — Zod op Hevy/Apple Health response, gestructureerde API errors, SWR hooks netjes gescheiden in `src/hooks/`. De drie grote kwetsbaarheden zijn: (1) productie-`console.log`-ruis in de Apple Health ingest-route die live secrets-nabije data logt naar stdout, (2) een systematische zwakheid waarbij Supabase join-resultaten consequent via `as unknown as` worden gecast in plaats van Zod-parsing of typed selects, en (3) een formatteerhulpfunctie-epidemie — minstens 8 identieke of bijna-identieke functies (`formatDate`, `formatTime`, `formatWeek`, `formatDateRange`, `getISOWeekNumber`) verspreid over components die nooit worden gecentraliseerd. De Server/Client-grens is structureel verdacht: alle componenten draaien als Client Components (`"use client"` op 80+ files), ook puur-presentationele componenten zonder enige state of handler. Geen van dit vormt een productie-blocker, maar het geheel draagt bij aan fragmentatie en verhoogt de kans op regressies.

---

## Sectie 2: Top 20 Findings

### [P0] Debug console.log lekt payload-inhoud naar productie-stdout
**Bestand:** `src/app/api/ingest/apple-health/route.ts:155-166`
**Probleem:** Drie `console.log`-calls loggen de volledige metrieknamen, parse-resultaten en de eerste 5 body composition entries in JSON naar stdout. In productie (Vercel) gaat dit naar de loggregator. De payload bevat gewichts- en lichaamssamenstelling-data. Dit is hardcoded debug-code die na troubleshooting is vergeten.
```ts
console.log(`apple-health ingest: ${payload.data.metrics.length} metrics...`)
console.log(`apple-health ingest: parsed bodyWeight=...`)
console.log('apple-health ingest: bodyComp entries:', JSON.stringify(parsedBodyComposition.slice(0, 5)))
```
**Fix:** Verwijder alle drie regels. Als observability nodig is, gebruik `console.error` alleen bij daadwerkelijke fouten, of introduceer een `logger.debug()` die alleen in `NODE_ENV=development` actief is.
**Geschatte impact:** Stopt data-lekkage naar Vercel logs; verwijdert noise die de log-signal-ratio verslechtert.

---

### [P1] `as unknown as` op Supabase join-resultaten — structureel patroon
**Bestanden:**
- `src/app/api/progress/exercise/route.ts:80,91`
- `src/app/api/progress/exercises/route.ts:43,46`
- `src/app/api/chat/route.ts:429,485`
- `src/app/api/schema/week/route.ts:244,406`
- `src/lib/ai/context-assembler.ts:291,441`

**Probleem:** Supabase's `select()` met joins geeft een `Json` type terug voor nested tabellen. In plaats van dit te parsen via Zod of de TypeScript-types uit database.ts te gebruiken met een cast die gevalideerd is, wordt overal `as unknown as { ... }` gebruikt. Dit is een type-correctheids-bypass: als de DB-query verandert (column hernoemd, type gewijzigd), crasht de runtime maar geeft TypeScript geen waarschuwing meer.

Concreet voorbeeld — `src/app/api/progress/exercise/route.ts:80`:
```ts
const workout = we.workouts as unknown as { started_at: string }
```
Supabase genereert wél de juiste types voor `workouts` in `database.ts`. Het probleem is dat `.select()` met expliciete joins het type verliest. De fix is om de Supabase query te voorzien van een expliciete type parameter, of een Zod schema te bouwen voor het join-resultaat.

**Fix (één plek, patroon voor de rest):**
```ts
const workoutSchema = z.object({ started_at: z.string(), user_id: z.string() })
const workout = workoutSchema.parse(we.workouts)
```
Of gebruik een Supabase typed query helper met `.returns<T>()`.

**Geschatte impact:** Elimineert 10+ stille type-correctheids-bugs; maakt schema-migraties detecteerbaar door TypeScript in plaats van runtime-crashes.

---

### [P1] `createClient()` patcht `auth.getUser` via `as unknown as Record<string, unknown>`
**Bestand:** `src/lib/supabase/server.ts:15`
**Probleem:**
```ts
;(admin.auth as unknown as Record<string, unknown>).getUser = async () => ({...})
```
Dit is het gevaarlijkste gebruik van `as unknown as` in de codebase: het monkey-patcht een bibliotheek-object door runtime-mutatie én bypast het type-systeem volledig. Als de Supabase SDK intern `auth` als read-only property markeert (wat toekomstige versies kunnen doen), crasht dit stil. Bovendien: als `PULSE_USER_ID` ontbreekt wordt een fout gegooid vóórdat de patch plaatsvindt — niet na — waardoor downstream routes nooit een `user` object zien.
**Fix:** Bouw een eigen wrapper-interface die de single-user auth simuleert zonder `auth` te muteren. Geef een eigen object terug dat de interface van de Supabase client nabootst maar `getUser` als eigen methode implementeert, of gebruik een Supabase-ondersteunde manier om de session te injecteren.
**Geschatte impact:** Verwijdert de enige runtime-mutatie van een extern object in de codebase; maakt single-user mode robuuster bij SDK-upgrades.

---

### [P1] `extractWritebacks` gebruikt stille catch — malformed Claude output wordt weggegooid
**Bestand:** `src/app/api/chat/route.ts:67-105`
**Probleem:** Vier afzonderlijke `try/catch`-blokken die elk een `JSON.parse` proberen hebben een lege `catch`-body met commentaar `// ignore malformed JSON`. Dit betekent dat als Claude een `<nutrition_log>` tag uitzendt met syntaxfouten in de JSON, de write-back stil faalt. De gebruiker denkt dat zijn voedingslog is opgeslagen; dat is niet zo.
```ts
try {
  nutritionLog = JSON.parse(nutritionMatch[1].trim()) as NutritionLogData
} catch {
  // ignore malformed JSON
}
```
**Fix:** Log minstens `console.error` bij een parse-fout (zodat Vercel-logs het registreren), of geef de clean-text terug met een indicator dat de write-back mislukt is zodat de frontend de gebruiker kan informeren.
**Geschatte impact:** Maakt stille data-loss zichtbaar; helpt bij het debuggen van prompt-regressions.

---

### [P1] `formatDate`/`formatTime`/`formatWeek` in minimaal 6 componenten gedupliceerd
**Bestanden:**
- `src/components/home/WorkoutFeedCard.tsx:18-36`
- `src/components/home/ActivityCard.tsx:18-36`
- `src/components/progress/StrengthChart.tsx:37-39`
- `src/components/progress/VolumeChart.tsx:31-33`
- `src/components/progress/RunningChart.tsx:29-31`
- `src/components/progress/ProgressionChart.tsx:9-15`
- `src/components/progress/PRList.tsx:13-18`
- `src/components/check-in/WeekPlanCard.tsx:67-73`

**Probleem:** `formatDate` in `WorkoutFeedCard.tsx` en `ActivityCard.tsx` zijn byte-voor-byte identiek (inclusief de array van dag-afkortingen). `formatWeek` in drie chart-componenten zijn identiek. Dit is duplicatie die al tot een bug heeft geleid: een toekomstige locale-aanpassing (bv. timezone-correctie voor UTC-opgeslagen datums) moet op 6+ plekken worden aangepast.

**Fix:** Maak `src/lib/formatters.ts` met exports: `formatRelativeDate`, `formatTime`, `formatWeekLabel`, `formatShortDate`, `formatDateRange`. Importeer overal vandaar.
**Geschatte impact:** Één fix propageert naar alle componenten; elimineert 6 divergentie-bronnen.

---

### [P1] `getISOWeekNumber` op 4 plekken anders geïmplementeerd
**Bestanden:**
- `src/app/api/check-in/status/route.ts:17` — neemt `dateStr`, returnt `number`
- `src/app/api/check-in/review/route.ts:92` — neemt `dateStr`, returnt `{ weekNumber, year }`
- `src/components/schema/SchemaWeekView.tsx:13` — neemt `dateStr`, returnt `number`
- `src/lib/aggregations/weekly.ts:4` — neemt `Date`, returnt `number`

**Probleem:** Vier implementaties, drie verschillende signatures, twee verschillende return types. Inconsistentie hier is direct zichtbaar in de UI: week-nummers kunnen 1 week verschil tonen afhankelijk van welk component de berekening doet. De implementatie in `check-in/review/route.ts` (maandag = week 1) kan afwijken van `weekly.ts` als de edge cases (jaarwisseling) anders worden behandeld.

**Fix:** Exporteer één functie `getISOWeek(date: Date): { weekNumber: number; year: number }` vanuit `src/lib/date-utils.ts`. Gebruik deze overal.
**Geschatte impact:** Elimineert potentiële week-nummer-inconsistenties in UI; maakt week-gerelateerde bugs detecteerbaar op één plek.

---

### [P2] `getMonday` / week-start berekening op 6 plekken inline gedupliceerd
**Bestanden:**
- `src/app/api/check-in/status/route.ts:11-12`
- `src/app/api/check-in/review/route.ts:79-81`
- `src/app/api/ingest/apple-health/route.ts:504-506`
- `src/app/api/ingest/hevy/sync/route.ts:10-11`
- `src/app/api/dashboard/route.ts:19-20`
- `src/app/api/cron/hevy-sync/route.ts:10-11`

**Probleem:** Allemaal varianten van `const offset = day === 0 ? -6 : 1 - day`. Geen enkel heeft een naam; ze staan gewoon inline. Eén heeft een andere offset-formule (`day === 0 ? 6 : day - 1` in `review/route.ts`). Dit is een off-by-one-risico.

**Fix:** `src/lib/date-utils.ts`: `export function getMondayOf(date: Date): Date { ... }`.
**Geschatte impact:** Elimineert mogelijke off-by-one in week-start berekeningen die aggregaties en check-in data kunnen verkorten/verlengen.

---

### [P2] `"use client"` op pure presentatie-componenten zonder client-side noodzaak
**Bestanden:**
- `src/components/home/MuscleGroupDot.tsx` — alleen een const-map en render
- `src/components/home/TodayWorkoutCard.tsx` — geen state, hooks, of event handlers
- `src/components/home/WeekAtAGlance.tsx` — geen state, hooks, of event handlers
- `src/components/dashboard/TrainingBlockIndicator.tsx` — geen state, hooks, of event handlers
- `src/components/dashboard/SportSplit.tsx` — geen state, hooks, of event handlers
- `src/components/dashboard/AdherenceTracker.tsx` — geen state, hooks, of event handlers

**Probleem:** Elk van deze componenten heeft `"use client"` maar gebruikt geen enkel client-side API. Omdat ze props ontvangen van een parent Client Component (zoals `DashboardPage`), worden ze al automatisch als client behandeld. De expliciete `"use client"` is hier ruis, maar het grotere probleem is dat ze niet als RSC kunnen worden gerenderd als de parent ooit refactored wordt naar RSC, omdat de directive dan op de child staat.

**Fix:** Verwijder `"use client"` van alle zes. Voeg pas terug als een specifieke reden ontstaat.
**Geschatte impact:** Correcte Server/Client boundary; vermindert client-bundle-grootte marginaal.

---

### [P2] `useEffect` om state te synchroniseren met props — moet `useMemo` of direct compute zijn
**Bestanden:**
- `src/components/settings/SettingsPage.tsx:75-88` — 8 `setState`-calls in één `useEffect` die data.profile naar local state kopieert
- `src/components/settings/AIContextSection.tsx:17-19` — synct `currentValue` prop naar `value` state
- `src/components/check-in/WeekPlanCard.tsx:384-389` — synct `plan.sessions` naar `sessions` state

**Probleem:** `useEffect` voor het synchroniseren van props naar state is een React anti-pattern. Het veroorzaakt een extra render-cycle en kan leiden tot "stale state" bugs als de prop snel verandert. In `SettingsPage.tsx` is het extra ernstig: 8 afzonderlijke `setState`-calls in één effect veroorzaken geen batch-update in React 17, en zelfs in React 18 is het onnodig.

`AIContextSection.tsx` is het duidelijkste geval: `const [value, setValue] = useState(currentValue ?? '')` gecombineerd met `useEffect(() => { setValue(currentValue ?? '') }, [currentValue])` kan worden vervangen door een `key` prop op het parent-component, of de `useState` initializer is al voldoende als de component unmounts bij prop-wijziging.

**Fix voor `AIContextSection`:**
```ts
// Verwijder useEffect. Gebruik key={currentValue} op de parent
// OF: gebruik geen state, maar een controlled input via prop
```
**Fix voor `SettingsPage`:** Bereken de initiële state server-side of gebruik `useReducer` met een initialisatie-functie die de data-prop direct accepteert.

**Geschatte impact:** Verwijdert extra render-cycles; elimineert potentiële race conditions bij snelle data-refreshes.

---

### [P2] `key={index}` op dynamische (non-skeleton) lijsten
**Bestanden:**
- `src/components/schema/DayDetailSheet.tsx:85` — `<ExerciseRow key={i} exercise={exercise} />`
- `src/components/progress/ProgressionChart.tsx:196` — `key={i}` op SVG-elementen in een chart
- `src/components/check-in/WeekReviewCard.tsx:256` — `key={i}` op workout-rijen

**Probleem:** Op skeleton-components is `key={index}` acceptabel (de lijst is statisch en items zijn niet herordend). Op echte data-rijen (`ExerciseRow`, ProgressionChart SVG-elementen, workout-rijen) is het een React-anti-pattern: bij reordering of filtering van de lijst recycleert React het verkeerde DOM-element, wat leidt tot state-mismatch in child-components.

**Fix:** Gebruik de exercise-naam, workout-ID, of een ander stabiel ID als key.
**Geschatte impact:** Voorkomt visuele state-bugs bij hersortering of filtering van oefeningen.

---

### [P2] `hevyFetch` returnt `response.json() as Promise<T>` zonder Zod
**Bestand:** `src/lib/hevy/client.ts:53`
**Probleem:**
```ts
return response.json() as Promise<T>
```
De generieke `hevyFetch<T>` functie geeft de rauwe JSON terug als `Promise<T>` via een type cast. De callers (`getWorkouts`, `getExerciseTemplates`, `getRoutines`) parsen daarna wél via Zod, maar dit werkt alleen omdat de callers toevallig `hevyFetch<unknown>` aanroepen. Als iemand `hevyFetch<HevyWorkout>` aanroept, slaat de Zod-validatie over. De functie is dus impliciet onveilig.

**Fix:** Verwijder de generieke parameter `T` uit `hevyFetch`. Returntype is altijd `Promise<unknown>`. Laat elke caller zelf parsen.
**Geschatte impact:** Maakt het onmogelijk om Zod-validatie per ongeluk te omzeilen in toekomstige Hevy API-callers.

---

### [P2] `SchemaPageContent` dubbel-fetcht via `useSchema` én `useSchemaWeek`
**Bestand:** `src/components/schema/SchemaPageContent.tsx:42-43`
**Probleem:**
```ts
const { data, error, isLoading, mutate } = useSchema()       // GET /api/schema
const { data: weekData, refresh: refreshWeek } = useSchemaWeek() // GET /api/schema/week
```
Eén component triggert twee afzonderlijke API-calls. `useSchema` haalt het schema-template op; `useSchemaWeek` haalt de week-view op met workout-status. Ze overlappen in data (beide returneren schedule-items). De `refreshWeek` wordt alleen aangeroepen na mutaties, wat suggereert dat `weekData` eigenlijk afgeleid kan worden van `data` gecombineerd met workout-completion status.

**Fix:** Evalueer of `/api/schema/week` de enige noodzakelijke endpoint is voor deze view, en of de schema-metadata inline kan worden meegestuurd. Als beide endpoints nodig zijn: documenteer expliciet waarom.
**Geschatte impact:** Halveert API-calls op de schema-pagina bij elke render.

---

### [P2] `CoachAnalysisCard` fetcht data in `useEffect` — moet SWR of Tanstack Query zijn
**Bestand:** `src/components/check-in/CoachAnalysisCard.tsx:37-73`
**Probleem:** Een custom `useEffect` + `useRef(hasFetched)` + manual `setLoading/setError` pattern implementeert ad-hoc wat SWR al biedt. Het bevat ook een retry-bug: `handleRetry()` zet `hasFetched.current = false` tweemaal achter elkaar (regels 76-80), maar de tweede reset is redundant en suggereert een kopieer-pasta fout.

**Fix:** Vervang door een SWR `useSWRMutation` of een custom hook `useCheckInAnalysis(reviewData, manualAdditions)` die de `POST` afhandelt. Elimineer de `hasFetched` ref.
**Geschatte impact:** Verwijdert buggy retry-logica; krijgt automatisch loading/error state management van SWR.

---

### [P2] Types geëxporteerd vanuit `route.ts` bestanden — coupling van API naar componenten
**Bestanden:**
- `src/app/api/check-in/review/route.ts` — exporteert `CheckInReviewData`, `DetectedGap`
- `src/app/api/check-in/analyze/route.ts` — exporteert `AnalyzeResponse`
- `src/app/api/progress/exercise/route.ts` — exporteert `ExerciseProgressResponse`, `ExerciseProgressPoint`
- `src/app/api/progress/exercises/route.ts` — exporteert `ExerciseListItem`
- `src/app/api/check-in/plan/route.ts` — exporteert `PlannedSession`, `WeekPlan`

**Probleem:** Vijf componenten importeren types direct vanuit route-bestanden via `import type { ... } from '@/app/api/check-in/review/route'`. Dit koppelt de component-laag aan de API-laag. Als een route file gesplitst of hernoemd wordt, breken de component-imports. Route files zijn bedoeld als transport-laag, niet als type-definities.

**Fix:** Verplaats gedeelde types naar `src/types/` of `src/lib/schemas/`. Exporteer vanuit route files alleen de handler functies.
**Geschatte impact:** Verbreekt de circulaire conceptuele koppeling component↔route; maakt types herbruikbaar in toekomstige transports (Server Actions, etc.).

---

### [P3] `src/components/muscles/bodyMapData.ts` staat in components in plaats van lib
**Bestand:** `src/components/muscles/bodyMapData.ts`
**Probleem:** Een 43-regel data-bestand met SVG path-strings, interfaces en constanten staat in `src/components/muscles/`. Het bevat geen JSX, geen React en heeft geen componentgedrag. Het is een data-asset die thuishoort in `src/lib/` of `src/data/`.

**Fix:** Verplaats naar `src/lib/body-map/data.ts`. Update de import in `src/components/dashboard/MuscleHeatmap.tsx`.
**Geschatte impact:** Betere file-structuur-scheiding; maakt de data herbruikbaar buiten components.

---

### [P3] `src/proxy.ts` — onbekend gebruik, mogelijke dead code
**Bestand:** `src/proxy.ts`
**Probleem:** Dit bestand staat in `src/` root (niet in `app/`, `lib/`, of `components/`) en importeert de Supabase client met `NEXT_PUBLIC_` env vars. Geen enkel ander bestand in de codebase importeert vanuit `src/proxy.ts`. Het lijkt een vergeten ontwikkel-hulpmiddel.

**Fix:** Controleer of dit bestand ooit gebruikt wordt. Als niet: verwijder.
**Geschatte impact:** Verwijdert verwarrende dead code; elimineert onnodig vertrouwen op `NEXT_PUBLIC_` keys in een server-only context.

---

### [P3] Sport-type strings `'gym' | 'run' | 'padel'` zijn inline literals op 10+ plekken
**Bestanden:**
- `src/app/api/check-in/plan/route.ts:20,48`
- `src/app/api/check-in/confirm/route.ts:25,172`
- `src/app/api/check-in/review/route.ts:28,126,144,155`
- `src/app/api/activities/route.ts:9`
- `src/components/home/WeekAtAGlance.tsx:11`

**Probleem:** Geen enkel centraal type of enum voor sport types. Als een sport type toegevoegd wordt (bijv. `'cycle'`), moeten 10+ bestanden worden bijgewerkt. De Zod schema's en TypeScript union types zijn niet gecoördineerd.

**Fix:** Definieer in `src/lib/constants.ts`:
```ts
export const SPORT_TYPES = ['gym', 'run', 'padel'] as const
export type SportType = typeof SPORT_TYPES[number]
export const SportTypeSchema = z.enum(SPORT_TYPES)
```
**Geschatte impact:** Eén plek om sport types uit te breiden; automatische validatie-synchronisatie via `SportTypeSchema`.

---

### [P3] `ProgressPage.tsx` gebruikt `useEffect` voor auto-select van eerste oefening
**Bestand:** `src/components/progress/ProgressPage.tsx:37-41`
**Probleem:**
```ts
useEffect(() => {
  if (!selectedExercise && exercises.length > 0) {
    setSelectedExercise(exercises[0].name)
  }
}, [exercises, selectedExercise])
```
Dit is afgeleide state: de geselecteerde oefening wanneer er niets geselecteerd is, is altijd `exercises[0]`. Dit patroon veroorzaakt een extra render-cycle (component rendert met `selectedExercise = null`, daarna opnieuw met `exercises[0]`).

**Fix:** Gebruik geen state voor de "selected exercise" als er geen andere geselecteerde waarde is. Bereken inline: `const activeExercise = selectedExercise ?? exercises[0]?.name ?? null`.
**Geschatte impact:** Verwijdert één render-cycle bij eerste load van de progress-pagina.

---

### [P3] `handleSaveProfile`, `handleSaveConnections`, `handleSaveGoals` in SettingsPage — geen error feedback aan gebruiker
**Bestand:** `src/components/settings/SettingsPage.tsx:90-136`
**Probleem:**
```ts
await fetch('/api/settings', {...}).then((r) => { if (!r.ok) throw new Error() })
```
Als de fetch faalt, wordt een `new Error()` gegooid zonder bericht. Er is geen try/catch in de component die dit afhandelt en de gebruiker een foutmelding toont. De save-button verdwijnt in een pending state maar de gebruiker weet niet of het gelukt is.

**Fix:** Wrap elke handleSave in try/catch, toon een toast of inline error state bij failure.
**Geschatte impact:** Verbetert UX bij netwerk- of validatiefouten in settings.

---

## Sectie 3: Cross-cutting Patterns

### TypeScript hygiene-score
- `any` usage: **0 directe `: any`** in src/ (goed)
- `as unknown as`: **16 gevallen** in 9 bestanden
- `@ts-ignore` / `@ts-expect-error`: **0** (goed)
- `console.log`: **3 gevallen** in `src/app/api/ingest/apple-health/route.ts` (productie-code)
- Inschatting: ~85% van src/ is "schoon" (geen weak types), maar de 15% betreft kritieke paths (Supabase joins, chat writeback, single-user auth)

### Server/Client ratio
- Totaal `.tsx` componenten: **~90**
- Met `"use client"`: **83 bestanden**
- Waarvan écht client-side nodig (state/effects/handlers): **~65**
- Onnodig `"use client"`: geschat **~18 bestanden** (puur-presentationele componenten die als RSC kunnen draaien maar via een client-parent al hydreren)
- Probleem: er zijn **geen RSC-paginas** die direct data fetchen — alles gaat via SWR + API routes. Dit is consistent maar mist de Next.js App Router voordelen van streaming RSC.

### Zod-coverage op route-inputs
- Routes die `request.json()` verwerken: **19**
- Routes met Zod-validatie: **17**
- Routes zonder Zod: **2** (`src/app/api/admin/seed-memory/route.ts`, `src/app/api/ingest/apple-health/route.ts`)
- `apple-health/route.ts` valideert via `parseHealthPayload` (een custom Zod wrapper in `src/lib/apple-health/types.ts`) — dit telt als gedekt. Alleen `admin/seed-memory/route.ts` is volledig ongedekt.
- **Conclusie:** Zod-coverage is 94% — goed. Het patroon is consistent.

---

## Sectie 4: Direct Uitvoerbare Acties (Top 5 PRs)

1. **`fix/remove-debug-logs`** — Verwijder de drie `console.log` calls in `/Users/stef/Code/pulse/src/app/api/ingest/apple-health/route.ts` (regels 155-166). Directe impact: geen health-data meer in Vercel logs.

2. **`feat/date-formatters-lib`** — Maak `/Users/stef/Code/pulse/src/lib/date-utils.ts` met: `getMondayOf(date: Date)`, `getISOWeek(date: Date)`, `formatRelativeDate(iso: string)`, `formatTime(iso: string)`, `formatWeekLabel(dateStr: string)`, `formatDateRange(start: string, end: string)`. Vervang de 8+ inline duplicaten in `src/components/home/WorkoutFeedCard.tsx`, `src/components/home/ActivityCard.tsx`, `src/components/progress/StrengthChart.tsx`, `src/components/progress/VolumeChart.tsx`, `src/components/progress/RunningChart.tsx`, `src/components/check-in/CheckInFlow.tsx`, `src/components/check-in/CheckInHistoryPage.tsx`, en de 6 inline week-start berekeningen in API routes.

3. **`fix/supabase-join-types`** — Vervang alle 10 `as unknown as` casts op Supabase join-resultaten door Zod-schemas. Begin met de twee meest gebruikte paths: `/Users/stef/Code/pulse/src/app/api/progress/exercises/route.ts` en `/Users/stef/Code/pulse/src/app/api/progress/exercise/route.ts`.

4. **`refactor/shared-types`** — Verplaats gedeelde types uit route-bestanden naar `/Users/stef/Code/pulse/src/types/check-in.ts` en `/Users/stef/Code/pulse/src/types/progress.ts`. Update de 10 import-referenties in componenten die nu direct van route-bestanden importeren.

5. **`fix/sport-type-constants`** — Definieer `SPORT_TYPES`, `SportType`, `SportTypeSchema` in `/Users/stef/Code/pulse/src/lib/constants.ts`. Vervang de 10+ inline union types en `z.enum(['gym', 'padel', 'run'])` duplicaten.

---

## Sectie 5: Open Vragen voor Stef

1. **`src/proxy.ts`** — Dit bestand staat in de root van `src/` maar wordt door niets geïmporteerd. Is dit een overblijfsel van een eerder lokaal-proxy-experiment? Kan het worden verwijderd?

2. **`useSchemaWeek` met `refreshInterval: 60_000`** — Schema-data verandert zelden (alleen na een bewuste mutatie). Is polling elke minuut hier echt nodig, of kan dit naar `revalidateOnFocus: true` + `refreshInterval: 0`?

3. **RSC vs SWR architecturale keuze** — Momenteel gebruikt de codebase SWR voor alle data-fetching. Gezien het App Router-project: was dit een bewuste keuze om alle pages interactief te houden, of zou een hybride aanpak (RSC voor initiële data, SWR voor mutaties) beter passen?

4. **`single-user mode`** — De `src/lib/supabase/server.ts` implementatie patcht `getUser` voor single-user mode. Is de intentie om Pulse ooit multi-user te maken? Als nee, dan is dit technische schuld die beter geadresseerd kan worden door alle `supabase.auth.getUser()` calls te vervangen door een directe `process.env.PULSE_USER_ID` read.

5. **`src/app/api/admin/seed-memory/route.ts`** — Geen auth-check, geen Zod-validatie. Is dit bewust een admin-only endpoint die niet publiek bereikbaar is, of is dit een veiligheidsrisico?
