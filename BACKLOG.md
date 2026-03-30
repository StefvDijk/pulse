# BACKLOG.md — Pulse Development Backlog

## Hoe deze backlog te lezen

Elke story is een kleine, afgebakende taak. Werk ze af in volgorde. Na elke story: test, commit, vraag Stef om review.

**Omvang indicatie:**
- **XS** = <30 minuten (config, kleine aanpassing)
- **S** = 30-60 minuten (enkel component, simpele logica)
- **M** = 1-2 uur (component + logica + database)
- **L** = 2-4 uur (complexe feature, meerdere bestanden)

**Status tracking:**
- `[ ]` = To do
- `[~]` = In progress
- `[x]` = Done

---

## Epic 0: Project Setup

### `PULSE-001` — Repository initialiseren
**Omvang:** S
**Beschrijving:** Maak een nieuw Next.js project aan met de juiste configuratie.
**Acceptatiecriteria:**
- [x] Next.js 14+ project met App Router en TypeScript
- [x] pnpm als package manager
- [x] Tailwind CSS geconfigureerd
- [x] ESLint + Prettier geconfigureerd
- [x] `tsconfig.json` met strict mode
- [x] `.env.local.example` met alle benodigde variabelen (leeg)
- [x] `pnpm dev` start zonder errors
- [x] Git repo geïnitialiseerd met `.gitignore`

### `PULSE-002` — Tailwind design tokens configureren
**Omvang:** XS
**Beschrijving:** Voeg de kleur tokens, typografie, en spacing uit de PRD toe aan Tailwind config.
**Acceptatiecriteria:**
- [x] Custom colors in `tailwind.config.ts` (bg-primary, bg-secondary, accent-primary, sport-gym, etc.)
- [x] Custom font family (Inter via Google Fonts of next/font)
- [x] Dark mode als default (geen toggle)
- [x] Voorbeeld pagina die alle kleuren toont (tijdelijk, voor verificatie)

### `PULSE-003` — Supabase project koppelen
**Omvang:** S
**Beschrijving:** Maak Supabase client configuratie aan. Lokaal én remote.
**Acceptatiecriteria:**
- [x] `supabase init` gedraaid
- [x] `src/lib/supabase/client.ts` — browser client (met `NEXT_PUBLIC_` keys)
- [x] `src/lib/supabase/server.ts` — server client (voor Server Components en Route Handlers)
- [x] `src/lib/supabase/admin.ts` — service role client (voor API routes die RLS bypassen)
- [x] `.env.local` gevuld met Supabase credentials
- [x] Connectie getest (simpele query)

### `PULSE-004` — Database migratie: Core tabellen
**Omvang:** M
**Beschrijving:** Maak de eerste migratie aan met de kern-tabellen.
**Acceptatiecriteria:**
- [x] Migratie `001_initial_schema.sql` met: `profiles`, `user_settings`, `workouts`, `exercise_definitions`, `workout_exercises`, `workout_sets`
- [x] Migratie draait zonder errors
- [x] Types gegenereerd naar `src/types/database.ts`

### `PULSE-005` — Database migratie: Runs, Padel, Activity
**Omvang:** S
**Beschrijving:** Voeg tabellen toe voor hardlopen, padel, en dagelijkse activiteit.
**Acceptatiecriteria:**
- [x] Migratie `002_activity_tables.sql` met: `runs`, `padel_sessions`, `daily_activity`
- [x] Types opnieuw gegenereerd

### `PULSE-006` — Database migratie: Voeding tabellen
**Omvang:** S
**Beschrijving:** Voeg voeding-gerelateerde tabellen toe.
**Acceptatiecriteria:**
- [x] Migratie `003_nutrition_tables.sql` met: `nutrition_logs`, `daily_nutrition_summary`
- [x] Types opnieuw gegenereerd

### `PULSE-007` — Database migratie: Chat & Blessures
**Omvang:** S
**Beschrijving:** Voeg chat en blessure tabellen toe.
**Acceptatiecriteria:**
- [x] Migratie `004_chat_injury_tables.sql` met: `chat_messages`, `chat_sessions`, `injury_logs`
- [x] Types opnieuw gegenereerd

### `PULSE-008` — Database migratie: Schema's & Doelen
**Omvang:** S
**Beschrijving:** Voeg trainingsschema en doelen tabellen toe.
**Acceptatiecriteria:**
- [x] Migratie `005_schema_goals_tables.sql` met: `training_schemas`, `schema_block_summaries`, `goals`, `personal_records`
- [x] Types opnieuw gegenereerd

### `PULSE-009` — Database migratie: Aggregatie tabellen
**Omvang:** S
**Beschrijving:** Voeg de aggregatie tabellen toe.
**Acceptatiecriteria:**
- [x] Migratie `006_aggregation_tables.sql` met: `daily_aggregations`, `weekly_aggregations`, `monthly_aggregations`
- [x] Types opnieuw gegenereerd

### `PULSE-010` — Database migratie: Indexen
**Omvang:** XS
**Beschrijving:** Voeg performance indexen toe.
**Acceptatiecriteria:**
- [x] Migratie `007_indexes.sql` met alle indexen uit PRD sectie 5.2
- [x] Migratie draait zonder errors

### `PULSE-011` — Database migratie: Row Level Security
**Omvang:** M
**Beschrijving:** Configureer RLS policies voor alle tabellen.
**Acceptatiecriteria:**
- [x] Migratie `008_rls_policies.sql`
- [x] RLS enabled op alle tabellen
- [x] Policy per tabel: users can only CRUD own data (WHERE auth.uid() = user_id)
- [x] Getest: query zonder auth retourneert 0 rows
- [x] Getest: query met auth retourneert alleen eigen data

### `PULSE-012` — Supabase Auth configureren
**Omvang:** S
**Beschrijving:** Configureer authenticatie.
**Acceptatiecriteria:**
- [x] Email/password auth enabled in Supabase dashboard
- [x] `src/app/auth/login/page.tsx` — simpel login formulier
- [x] `src/app/auth/signup/page.tsx` — simpel registratie formulier
- [x] Auth middleware die onbeveiligde routes redirect naar login
- [x] Na registratie: automatisch profiel aangemaakt in `profiles` tabel (via Supabase trigger of API)
- [x] Na login: redirect naar dashboard

### `PULSE-013` — Seed data: Exercise definities
**Omvang:** M
**Beschrijving:** Seed de `exercise_definitions` tabel met de ~40 meest voorkomende exercises.
**Acceptatiecriteria:**
- [x] Script `scripts/seed-exercises.ts` dat de exercise mappings uit PRD sectie 9.2 insert
- [x] Draait via `pnpm run seed:exercises`
- [x] Idempotent (kan meerdere keren draaien zonder duplicaten)
- [x] Alle exercises hebben correcte muscle groups en movement patterns

### `PULSE-014` — Seed data: Test data voor development
**Omvang:** M
**Beschrijving:** Genereer realistische test data zodat je het dashboard kunt ontwikkelen zonder echte API koppelingen.
**Acceptatiecriteria:**
- [x] Script `scripts/seed-test-data.ts`
- [x] Genereert 8 weken aan:
  - Gym workouts (3x/week, variërende oefeningen en gewichten met lichte progressie)
  - Runs (2x/week, variërende afstand en pace)
  - Padel sessies (1x/week)
  - Dagelijkse activiteit (stappen, calorieën, hartslag)
  - Voedingslogs (2-3 maaltijden per dag, sommige dagen leeg)
  - Dagelijkse en wekelijkse aggregaties
- [x] Data is realistisch (geen 500kg bench press, geen 2 min/km pace)
- [x] Draait via `pnpm run seed:testdata`

---

## Epic 1: Layout & Navigatie

### `PULSE-015` — Root layout met dark theme
**Omvang:** S
**Beschrijving:** Maak het root layout met dark background, font, en meta tags.
**Acceptatiecriteria:**
- [x] `src/app/layout.tsx` met dark bg, Inter font, viewport meta
- [x] HTML `<html>` element heeft `class="dark"` en dark background
- [x] Paginatitel: "Pulse"
- [x] Favicon (simpel, tijdelijk)

### `PULSE-016` — Bottom navigation (mobiel)
**Omvang:** M
**Beschrijving:** Maak de mobiele bottom navigation bar.
**Acceptatiecriteria:**
- [x] `src/components/layout/Navigation.tsx`
- [x] 5 tab items: Dashboard, Progressie, Voeding, Trends, Chat
- [x] Iconen (Lucide icons)
- [x] Active state highlighting (accent kleur)
- [x] Fixed aan onderkant van het scherm
- [x] Alleen zichtbaar op mobiel (<1024px)
- [x] Navigeert correct naar elke route

### `PULSE-017` — Sidebar navigatie (desktop)
**Omvang:** S
**Beschrijving:** Maak de desktop sidebar.
**Acceptatiecriteria:**
- [x] Sidebar in `Navigation.tsx` (responsieve variant)
- [x] Zichtbaar op desktop (>=1024px)
- [x] Zelfde items als bottom nav
- [x] Collapsed/expanded state (optioneel voor v1)
- [x] Logo/app naam bovenaan

### `PULSE-018` — Lege pagina scaffolds
**Omvang:** XS
**Beschrijving:** Maak lege pagina's aan voor alle routes met een placeholder titel.
**Acceptatiecriteria:**
- [x] `/` → "Dashboard"
- [x] `/progress` → "Progressie"
- [x] `/nutrition` → "Voeding"
- [x] `/trends` → "Trends"
- [x] `/chat` → "Chat"
- [x] `/goals` → "Doelen"
- [x] `/settings` → "Instellingen"
- [x] Navigatie werkt naar alle pagina's

---

## Epic 2: Data Ingest — Hevy API

### `PULSE-019` — Hevy API client
**Omvang:** M
**Beschrijving:** Bouw een client voor de Hevy API.
**Acceptatiecriteria:**
- [x] `src/lib/hevy/client.ts` met functies:
  - `getWorkouts(since?: Date, page?: number)` — haalt workouts op
  - `getWorkout(id: string)` — haalt één workout op met details
  - `getExerciseTemplates()` — haalt exercise definities op
  - `getRoutines()` — haalt routines op
- [x] Zod schema's voor alle API responses
- [x] Error handling (rate limits, auth errors)
- [x] API key uit `user_settings` tabel
- [x] Getest met een echte API call (als Stef zijn key heeft)

### `PULSE-020` — Hevy data mappers
**Omvang:** M
**Beschrijving:** Map Hevy API responses naar het Pulse database schema.
**Acceptatiecriteria:**
- [x] `src/lib/hevy/mappers.ts`:
  - `mapHevyWorkout(hevy: HevyWorkout) → { workout, exercises, sets }`
  - `mapHevyExercise(hevy: HevyExercise) → ExerciseDefinition`
- [x] Fuzzy matching van Hevy exercise namen naar `exercise_definitions`
- [x] Onbekende exercises worden gelogd (console.warn + optioneel in een `unmapped_exercises` tabel)
- [x] Unit tests voor de mapping functies

### `PULSE-021` — Hevy sync service
**Omvang:** M
**Beschrijving:** Service die nieuwe Hevy workouts ophaalt en opslaat.
**Acceptatiecriteria:**
- [x] `src/lib/hevy/sync.ts`:
  - `syncWorkouts(userId: string)` — haalt alle workouts op sinds `last_hevy_sync_at`, mapt en slaat op
  - Deduplicatie op `hevy_workout_id`
  - Update `last_hevy_sync_at` na succesvolle sync
- [x] Getest met test data

### `PULSE-022` — Hevy sync API route
**Omvang:** S
**Beschrijving:** API endpoint om Hevy sync te triggeren.
**Acceptatiecriteria:**
- [x] `POST /api/ingest/hevy/sync` — triggert sync voor ingelogde gebruiker
- [x] Auth check (Supabase session)
- [x] Response: `{ synced: number, errors: string[] }`

### `PULSE-023` — Hevy sync cron job
**Omvang:** S
**Beschrijving:** Periodieke automatische sync via Vercel Cron.
**Acceptatiecriteria:**
- [x] `GET /api/cron/hevy-sync` — synct alle gebruikers met een Hevy API key
- [x] Beveiligd met `CRON_SECRET`
- [x] Vercel cron configuratie in `vercel.json` (elke 15 min)
- [x] Error logging per gebruiker (één failing user blokkeert niet de rest)

### `PULSE-024` — Hevy webhook endpoint
**Omvang:** S
**Beschrijving:** Webhook voor real-time workout notificaties van Hevy.
**Acceptatiecriteria:**
- [x] `POST /api/ingest/hevy/webhook`
- [x] Webhook signature verificatie
- [x] Bij `workout.completed` event: sync die specifieke workout
- [x] Response: 200 OK

---

## Epic 3: Data Ingest — Apple Health

### `PULSE-025` — Apple Health parser
**Omvang:** M
**Beschrijving:** Parse het JSON formaat van Health Auto Export.
**Acceptatiecriteria:**
- [x] `src/lib/apple-health/parser.ts`
- [x] Documenteer het verwachte JSON formaat (of onderzoek via Health Auto Export docs)
- [x] Zod schema voor de payload
- [x] Parse functies per datatype: `parseWorkouts()`, `parseActivitySummary()`, `parseHeartRate()`, `parseHRV()`
- [x] Categoriseer workouts: running vs. padel vs. overig (op basis van workout type string)

### `PULSE-026` — Apple Health mappers
**Omvang:** M
**Beschrijving:** Map Apple Health data naar Pulse schema.
**Acceptatiecriteria:**
- [x] `src/lib/apple-health/mappers.ts`:
  - `mapRun(ahWorkout) → Run`
  - `mapPadelSession(ahWorkout) → PadelSession`
  - `mapDailyActivity(ahSummary) → DailyActivity`
- [x] Deduplicatie logica (op `apple_health_id`)
- [x] Intensiteit classificatie voor padel (op basis van gemiddelde hartslag)

### `PULSE-027` — Apple Health ingest endpoint
**Omvang:** M
**Beschrijving:** API endpoint waar Health Auto Export naartoe pusht.
**Acceptatiecriteria:**
- [x] `POST /api/ingest/apple-health`
- [x] Bearer token authenticatie (`HEALTH_EXPORT_AUTH_TOKEN`)
- [x] Parse payload → categoriseer → map → opslaan
- [x] Deduplicatie (upsert op apple_health_id)
- [x] Response: `{ processed: { runs: n, padel: n, activity: n }, errors: [] }`
- [x] Trigger aggregatie herberekening voor betreffende dagen

---

## Epic 4: Aggregatie Engine

### `PULSE-028` — Spiergroep belasting berekening
**Omvang:** M
**Beschrijving:** Bereken spiergroep belasting per workout.
**Acceptatiecriteria:**
- [x] `src/lib/aggregations/muscle-groups.ts`
- [x] `calculateMuscleLoad(workout)` functie per PRD sectie 9.3
- [x] Primary muscle = 100% volume, secondary = 50%
- [x] Normalisatie naar 0-100 schaal
- [x] Getest met voorbeeld workouts

### `PULSE-029` — Bewegingspatroon classificatie
**Omvang:** S
**Beschrijving:** Bereken volume per bewegingspatroon.
**Acceptatiecriteria:**
- [x] `src/lib/aggregations/movement-patterns.ts`
- [x] `calculateMovementVolume(workout)` → `{ push: n, pull: n, squat: n, hinge: n, ... }`
- [x] Volume = totaal aantal sets per patroon

### `PULSE-030` — Dagelijkse aggregatie
**Omvang:** M
**Beschrijving:** Bereken de dagelijkse aggregatie voor een specifieke datum.
**Acceptatiecriteria:**
- [x] `src/lib/aggregations/daily.ts`
- [x] `computeDailyAggregation(userId, date)`:
  - Totale trainingsminuten (gym + run + padel)
  - Totaal sets, reps, tonnage
  - Totale running km
  - Spiergroep belasting (JSON)
  - Bewegingspatroon volume (JSON)
  - Training load score (gewogen combinatie)
  - Is rest day (boolean)
- [x] Upsert naar `daily_aggregations`

### `PULSE-031` — Training load score berekening
**Omvang:** S
**Beschrijving:** Definieer hoe de training load score berekend wordt.
**Acceptatiecriteria:**
- [x] `src/lib/aggregations/workload.ts`
- [x] Training load per dag = gewogen combinatie van:
  - Gym: tonnage × duur factor
  - Running: afstand × pace factor × duur
  - Padel: duur × intensiteit factor
- [x] Documenteer de weging en redenering in comments

### `PULSE-032` — Wekelijkse aggregatie
**Omvang:** M
**Beschrijving:** Bereken de wekelijkse aggregatie.
**Acceptatiecriteria:**
- [x] `src/lib/aggregations/weekly.ts`
- [x] `computeWeeklyAggregation(userId, weekStart)`:
  - Sum van daily totalen
  - Sessie counts per sport
  - Acute load (gemiddelde daily load deze week)
  - Chronic load (gemiddelde daily load afgelopen 4 weken)
  - Acute:chronic ratio + status (low/optimal/warning/danger)
  - Schema adherence (geplande vs. voltooide sessies)
  - Voeding gemiddelden (als er nutrition logs zijn)
- [x] Upsert naar `weekly_aggregations`

### `PULSE-033` — Maandelijkse aggregatie
**Omvang:** M
**Beschrijving:** Bereken de maandelijkse aggregatie.
**Acceptatiecriteria:**
- [x] `src/lib/aggregations/monthly.ts`
- [x] `computeMonthlyAggregation(userId, month, year)`:
  - Totalen over alle weken
  - Strength highlights (beste lifts, progressie)
  - Running highlights
  - PRs van die maand
  - Gemiddelden
- [x] Upsert naar `monthly_aggregations`

### `PULSE-034` — Aggregatie API route
**Omvang:** S
**Beschrijving:** API endpoint om aggregaties te herberekenen.
**Acceptatiecriteria:**
- [x] `POST /api/aggregations/compute` met `{ type, date }`
- [x] Kan daily, weekly, of monthly herberekenen
- [x] Auth check

### `PULSE-035` — Aggregatie cron jobs
**Omvang:** S
**Beschrijving:** Automatische aggregatie berekening.
**Acceptatiecriteria:**
- [x] `GET /api/cron/daily-aggregate` — elke nacht om 02:00, berekent gisteren
- [x] `GET /api/cron/weekly-aggregate` — elke maandag om 03:00, berekent vorige week
- [x] Beveiligd met `CRON_SECRET`
- [x] Vercel cron configuratie

---

## Epic 5: Dashboard — Weekoverzicht

### `PULSE-036` — Dashboard layout
**Omvang:** S
**Beschrijving:** Maak de grid layout voor de dashboard pagina.
**Acceptatiecriteria:**
- [x] Mobiel: single column, cards gestapeld
- [x] Desktop: 2-3 kolommen grid
- [x] Placeholder cards voor elk dashboard component
- [x] Pull-to-refresh (optioneel, of refresh button)

### `PULSE-037` — Dashboard data hook
**Omvang:** M
**Beschrijving:** Custom hook die alle dashboard data ophaalt.
**Acceptatiecriteria:**
- [x] `src/hooks/useDashboardData.ts`
- [x] Haalt op via SWR:
  - Wekelijkse aggregatie (huidige week)
  - Dagelijkse aggregaties (deze week, 7 entries)
  - Actief trainingsschema
  - Workouts van deze week (voor adherence)
- [x] Loading state, error state
- [x] Auto-refresh elke 60 seconden

### `PULSE-038` — Workload Meter component
**Omvang:** M
**Beschrijving:** Semi-circulaire gauge die de acute:chronic ratio toont.
**Acceptatiecriteria:**
- [x] `src/components/dashboard/WorkloadMeter.tsx`
- [x] SVG gauge met gekleurde zones (groen/geel/rood)
- [x] Ratio getal groot in het midden
- [x] Status tekst eronder ("Optimaal", "Iets meer dan gewoonlijk", etc.)
- [x] Animatie bij laden (optioneel)
- [x] Props: `ratio: number`, `status: string`

### `PULSE-039` — Spiergroep Heatmap component
**Omvang:** L
**Beschrijving:** Body outline met gekleurde spiergroepen.
**Acceptatiecriteria:**
- [x] `src/components/dashboard/MuscleHeatmap.tsx`
- [x] SVG body outline (voor- en achterkant)
- [x] Elke spiergroep is een apart SVG path dat gekleurd kan worden
- [x] Kleur op basis van belasting (transparant → blauw → oranje → rood)
- [x] Tap op spiergroep toont tooltip met detail (welke oefeningen, hoeveel sets)
- [x] Props: `muscleLoad: Record<string, number>`
- [x] Responsive (schaalt mee met container)

### `PULSE-040` — Sport Split component
**Omvang:** S
**Beschrijving:** Overzicht van trainingsuren per sport.
**Acceptatiecriteria:**
- [x] `src/components/dashboard/SportSplit.tsx`
- [x] Drie horizontale bars (gym paars, running cyaan, padel amber)
- [x] Sessie count + totale duur per sport
- [x] Target indicators (geplande sessies als outline)
- [x] Props: `gymMinutes, runningMinutes, padelMinutes, targets`

### `PULSE-041` — Adherence Tracker component
**Omvang:** M
**Beschrijving:** Week visualisatie van geplande vs. gedane trainingen.
**Acceptatiecriteria:**
- [x] `src/components/dashboard/AdherenceTracker.tsx`
- [x] 7 cirkels (Ma-Zo)
- [x] Leeg = geen training gepland
- [x] Grijs outline = gepland maar niet gedaan
- [x] Gekleurd (per sport) = voltooid
- [x] Props: `schedule, completedWorkouts`

### `PULSE-042` — Training Block Indicator component
**Omvang:** S
**Beschrijving:** Toon waar je zit in je trainingsblok.
**Acceptatiecriteria:**
- [x] `src/components/dashboard/TrainingBlockIndicator.tsx`
- [x] Progressie bar (week X van Y)
- [x] Label: schema naam + fase (opbouw, piek, deload)
- [x] Link naar schema detail (of modal)
- [x] Props: `schemaTitle, currentWeek, totalWeeks, phase`

### `PULSE-043` — Dashboard pagina assembleren
**Omvang:** S
**Beschrijving:** Combineer alle dashboard componenten op de home pagina.
**Acceptatiecriteria:**
- [x] Alle componenten geïntegreerd in `/` pagina
- [x] Data hook gekoppeld aan componenten
- [x] Loading skeletons tijdens laden
- [x] Werkt op mobiel en desktop
- [x] Realistisch resultaat met test data

---

## Epic 6: Progressie Tab

### `PULSE-044` — Progressie data hook
**Omvang:** S
**Beschrijving:** Hook voor progressie data.
**Acceptatiecriteria:**
- [x] `src/hooks/useProgressData.ts`
- [x] Haalt op: wekelijkse aggregaties (range), PRs, doelen, run data
- [x] Tijdsperiode parameter (4w, 3m, 6m, 1y)

### `PULSE-045` — Strength progressie chart
**Omvang:** M
**Beschrijving:** Line chart met kracht per bewegingspatroon over tijd.
**Acceptatiecriteria:**
- [x] `src/components/progress/StrengthChart.tsx`
- [x] Recharts LineChart met meerdere lijnen (push, pull, squat, hinge)
- [x] Y-as: estimated 1RM (Epley formule) of totaal volume
- [x] X-as: weken
- [x] Tijdsperiode tabs (4w, 3m, 6m, 1y)
- [x] Tooltip met details bij hover/tap
- [x] Legenda met sport-kleuren

### `PULSE-046` — Running progressie chart
**Omvang:** M
**Beschrijving:** Combinatie chart voor running data.
**Acceptatiecriteria:**
- [x] `src/components/progress/RunningChart.tsx`
- [x] Bars: wekelijks volume (km)
- [x] Lijn: gemiddelde pace (sec/km)
- [x] Tijdsperiode tabs
- [x] Recharts ComposedChart

### `PULSE-047` — Volume trend chart
**Omvang:** M
**Beschrijving:** Stacked bar chart met totaal trainingsvolume per sport.
**Acceptatiecriteria:**
- [x] `src/components/progress/VolumeChart.tsx`
- [x] Recharts StackedBarChart
- [x] Gestapeld per sport (gym, running, padel)
- [x] Overlay lijn: acute:chronic ratio
- [x] Wekelijkse resolutie

### `PULSE-048` — Personal Records lijst
**Omvang:** M
**Beschrijving:** Lijst van personal records.
**Acceptatiecriteria:**
- [x] `src/components/progress/PRList.tsx`
- [x] Kaarten gesorteerd op datum (nieuwste eerst)
- [x] Per PR: exercise naam, waarde, datum, delta vs. vorig record
- [x] Filter: per sport/categorie
- [x] Highlight voor PRs van afgelopen week

### `PULSE-049` — Goal Progress kaarten
**Omvang:** M
**Beschrijving:** Voortgangskaarten per doel op de progressie pagina.
**Acceptatiecriteria:**
- [x] `src/components/progress/GoalProgress.tsx`
- [x] Per doel: titel, huidige waarde, target, progressie bar, deadline
- [x] Categorie badge (strength/running/padel/nutrition)
- [x] Mini sparkline van voortgang over tijd (optioneel v1, placeholder OK)

### `PULSE-050` — Progressie pagina assembleren
**Omvang:** S
**Beschrijving:** Combineer alle progressie componenten.
**Acceptatiecriteria:**
- [x] Alle charts en lijsten geïntegreerd op `/progress`
- [x] Tabbed layout of scroll sections
- [x] Responsive
- [x] Werkt met test data

---

## Epic 7: Voeding Tab

### `PULSE-051` — Voedingsanalyse prompt
**Omvang:** S
**Beschrijving:** Schrijf de Claude prompt voor voedingsanalyse.
**Acceptatiecriteria:**
- [x] `src/lib/ai/prompts/nutrition-analysis.ts`
- [x] System prompt die Claude instrueert om:
  - Natural language voedingsinput te analyseren
  - Geschatte calorieën, eiwit, koolhydraten, vet, vezels te retourneren
  - Confidence level (low/medium/high) aan te geven
  - Maaltijdtype te classificeren
- [x] Output als gestructureerd JSON
- [x] Vegetarisch-bewust (Stef eet grotendeels vegetarisch)

### `PULSE-052` — Voedingsanalyse API route
**Omvang:** M
**Beschrijving:** API endpoint voor voedingsanalyse.
**Acceptatiecriteria:**
- [x] `POST /api/nutrition/analyze`
- [x] Body: `{ input: string, date?: string, time?: string }`
- [x] Roept Claude API aan met nutrition prompt
- [x] Parse Claude response naar gestructureerde data
- [x] Sla op in `nutrition_logs`
- [x] Herbereken `daily_nutrition_summary`
- [x] Response: `{ calories, protein_g, carbs_g, fat_g, fiber_g, analysis, confidence, meal_type }`

### `PULSE-053` — Nutrition Input component
**Omvang:** M
**Beschrijving:** Natural language input veld voor voeding.
**Acceptatiecriteria:**
- [x] `src/components/nutrition/NutritionInput.tsx`
- [x] Tekstveld met placeholder: "Wat heb je gegeten?"
- [x] Submit button
- [x] Loading state tijdens analyse
- [x] Na submit: toon resultaat als kaart onder het input veld
- [x] Resultaat kaart: maaltijd tekst + geschatte macro's + confidence badge

### `PULSE-054` — Macro Summary component
**Omvang:** M
**Beschrijving:** Dag overzicht van macro's.
**Acceptatiecriteria:**
- [x] `src/components/nutrition/MacroSummary.tsx`
- [x] Donut chart (eiwit, koolhydraten, vet) met Recharts PieChart
- [x] Targets als buitenring of referentielijn
- [x] Totale calorieën als getal in het midden
- [x] Props: `{ calories, protein, carbs, fat, targets }`

### `PULSE-055` — Protein Tracker component
**Omvang:** S
**Beschrijving:** Prominente eiwit voortgangsbalk.
**Acceptatiecriteria:**
- [x] `src/components/nutrition/ProteinTracker.tsx`
- [x] Horizontale balk: huidige intake vs. target
- [x] Kleur: rood als <70% target, geel als 70-90%, groen als >=90%
- [x] Label: "92g / 130g eiwit"

### `PULSE-056` — Day Status Indicator
**Omvang:** S
**Beschrijving:** Globale dag-indicator voor voeding.
**Acceptatiecriteria:**
- [x] `src/components/nutrition/DayIndicator.tsx`
- [x] Kleur badge (groen/geel/rood) met korte tekst
- [x] Logica: op basis van eiwit target + calorie range
- [x] Tekst voorbeelden: "Je zit goed vandaag", "Je mist nog ~40g eiwit"

### `PULSE-057` — Maaltijden lijst
**Omvang:** S
**Beschrijving:** Chronologische lijst van alle maaltijden vandaag.
**Acceptatiecriteria:**
- [x] Lijst onder de macro summary
- [x] Per entry: tijd, raw input tekst, geschatte macro's compact
- [x] Verwijder knop per entry

### `PULSE-058` — Voeding pagina assembleren
**Omvang:** S
**Beschrijving:** Combineer alle voeding componenten.
**Acceptatiecriteria:**
- [x] Input bovenaan
- [x] Day indicator
- [x] Macro summary + protein tracker
- [x] Maaltijden lijst
- [x] Responsive

---

## Epic 8: Chat Agent

### `PULSE-059` — Claude API client
**Omvang:** S
**Beschrijving:** Configureer de Anthropic SDK client.
**Acceptatiecriteria:**
- [x] `src/lib/ai/client.ts`
- [x] Anthropic SDK client met API key
- [x] Helper functie voor streaming responses
- [x] Helper functie voor JSON mode responses
- [x] Error handling wrapper

### `PULSE-060` — Chat system prompt
**Omvang:** M
**Beschrijving:** Schrijf de system prompt voor de chat agent.
**Acceptatiecriteria:**
- [x] `src/lib/ai/prompts/chat-system.ts`
- [x] Volledige system prompt per PRD sectie 6.5.2
- [x] Nederlands als taal
- [x] Rollen en capabilities duidelijk gedefinieerd
- [x] Beperkingen benoemd

### `PULSE-061` — Vraag-type classifier
**Omvang:** M
**Beschrijving:** Classificeer gebruikersvragen voor de context assembler.
**Acceptatiecriteria:**
- [x] `src/lib/ai/context-assembler.ts` (classificatie deel)
- [x] `classifyQuestion(message: string): QuestionType`
- [x] Types: nutrition_log, nutrition_question, injury_report, schema_request, progress_question, weekly_review, general_chat
- [x] Keyword-based matching (geen extra Claude call nodig)
- [x] Fallback: general_chat

### `PULSE-062` — Context assembler: data queries
**Omvang:** L
**Beschrijving:** Bouw de relevante data context per vraag-type.
**Acceptatiecriteria:**
- [x] `src/lib/ai/context-assembler.ts` (data assembly deel)
- [x] `assembleContext(userId, questionType): string`
- [x] Per vraag-type: de juiste queries (zie PRD sectie 4.4)
- [x] Output als geformatteerde tekst string (<8000 tokens)
- [x] Compressie strategie per data type (zie PRD sectie 4.5)

### `PULSE-063` — Chat API route (streaming)
**Omvang:** M
**Beschrijving:** Streaming chat endpoint.
**Acceptatiecriteria:**
- [x] `POST /api/chat`
- [x] Body: `{ message: string, session_id?: string }`
- [x] Classificeer vraag → assembleer context → stream Claude response
- [x] Sla user message en assistant response op in `chat_messages`
- [x] Maak of update `chat_sessions`
- [x] Response: `text/event-stream`

### `PULSE-064` — Chat write-back: voeding
**Omvang:** S
**Beschrijving:** Als de chat agent voedingsdata genereert, sla het op.
**Acceptatiecriteria:**
- [x] Detecteer in de chat response of er voedingsanalyse zit
- [x] Zo ja: parse en sla op in `nutrition_logs`
- [x] Herbereken `daily_nutrition_summary`

### `PULSE-065` — Chat write-back: blessure
**Omvang:** S
**Beschrijving:** Als de gebruiker een blessure meldt via chat, sla het op.
**Acceptatiecriteria:**
- [x] Bij `injury_report` type: sla op in `injury_logs`
- [x] Body location, beschrijving, AI analyse, aanbevelingen
- [x] Link naar gerelateerde workouts

### `PULSE-066` — Chat Interface component
**Omvang:** M
**Beschrijving:** De chat UI.
**Acceptatiecriteria:**
- [x] `src/components/chat/ChatInterface.tsx`
- [x] Berichtenlijst met scroll
- [x] User berichten rechts (blauw), assistant links (donker)
- [x] Markdown rendering in berichten
- [x] Auto-scroll naar nieuwste bericht
- [x] Streaming tekst effect (letter voor letter verschijnen)

### `PULSE-067` — Chat Input component
**Omvang:** S
**Beschrijving:** Input veld voor chat.
**Acceptatiecriteria:**
- [x] `src/components/chat/ChatInput.tsx`
- [x] Tekstveld met submit button
- [x] Enter = verstuur (Shift+Enter = newline)
- [x] Disabled tijdens streaming response
- [x] Auto-focus

### `PULSE-068` — Chat Suggestions component
**Omvang:** S
**Beschrijving:** Voorgestelde vragen.
**Acceptatiecriteria:**
- [x] `src/components/chat/ChatSuggestions.tsx`
- [x] 3-4 klikbare suggesties
- [x] Context-afhankelijk (dag van de week, recent activity)
- [x] Verdwijnen na eerste bericht
- [x] Props: `onSelect(suggestion: string)`

### `PULSE-069` — Chat pagina assembleren
**Omvang:** S
**Beschrijving:** Combineer chat componenten op de chat pagina.
**Acceptatiecriteria:**
- [x] Full page chat interface op `/chat`
- [x] Chat sessie management (nieuw gesprek starten)
- [x] Suggesties bij start
- [x] Streaming werkt

### `PULSE-070` — Floating Mini Chat
**Omvang:** M
**Beschrijving:** Floating chat button + compact chat window op alle pagina's.
**Acceptatiecriteria:**
- [x] `src/components/layout/MiniChat.tsx`
- [x] Floating action button rechtsonder (boven bottom nav op mobiel)
- [x] Klik = expand naar compact chat window (300x400px)
- [x] Zelfde functionaliteit als full chat maar compact
- [x] "Open volledig" link naar `/chat`
- [x] Sluit bij klik buiten het window

---

## Epic 9: Doelen

### `PULSE-071` — Doel aanmaken formulier
**Omvang:** M
**Beschrijving:** Formulier om een nieuw doel aan te maken.
**Acceptatiecriteria:**
- [x] `src/components/goals/GoalForm.tsx`
- [x] Velden: titel, categorie (dropdown), target waarde + unit, deadline (optioneel)
- [x] Validatie
- [x] Submit slaat op in `goals` tabel

### `PULSE-072` — Doelen overzicht pagina
**Omvang:** M
**Beschrijving:** Pagina met alle doelen.
**Acceptatiecriteria:**
- [x] `/goals` pagina
- [x] Actieve doelen bovenaan (gesorteerd op prioriteit)
- [x] Voltooide doelen onderaan (collapsed)
- [x] Per doel: kaart met titel, progressie, deadline
- [x] Acties: bewerken, pauzeren, voltooien, verwijderen

### `PULSE-073` — Goal auto-tracking
**Omvang:** M
**Beschrijving:** Automatisch doelen bijwerken op basis van nieuwe data.
**Acceptatiecriteria:**
- [x] `src/lib/goals/auto-track.ts`
- [x] Na elke data ingest: check of doelen geupdated moeten worden
- [x] Strength doelen: update `current_value` op basis van e1RM
- [x] Running doelen: update op basis van beste recente run
- [x] Frequentie doelen: update op basis van wekelijkse sessie count
- [x] Markeer als `completed` als target bereikt

---

## Epic 10: Trends Tab

### `PULSE-074` — Maand vergelijking component
**Omvang:** M
**Beschrijving:** Side-by-side vergelijking van huidige vs. vorige maand.
**Acceptatiecriteria:**
- [x] `src/components/trends/MonthComparison.tsx`
- [x] Twee kaarten naast elkaar
- [x] Metrics: sessies, tonnage, km, eiwit gemiddelde
- [x] Delta's met pijlen en percentages (groen omhoog, rood omlaag)

### `PULSE-075` — Kwartaal vergelijking component
**Omvang:** M
**Beschrijving:** Kwartaal-over-kwartaal vergelijking.
**Acceptatiecriteria:**
- [x] `src/components/trends/QuarterComparison.tsx`
- [x] Zelfde structuur als maand maar over 3 maanden
- [x] Extra: strength highlights (beste lifts van het kwartaal)

### `PULSE-076` — "Een jaar geleden" snapshot
**Omvang:** S
**Beschrijving:** Wat deed je een jaar geleden?
**Acceptatiecriteria:**
- [x] `src/components/trends/YearAgoSnapshot.tsx`
- [x] Haal data op van dezelfde week vorig jaar
- [x] Toon als kaart met vergelijking: "Een jaar geleden: bench 55kg, nu 70kg (+27%)"
- [x] Placeholder als niet genoeg data

### `PULSE-077` — Trends pagina assembleren
**Omvang:** S
**Beschrijving:** Combineer trend componenten.
**Acceptatiecriteria:**
- [x] Maand vergelijking bovenaan
- [x] Kwartaal daaronder
- [x] "Een jaar geleden" onderaan
- [x] Responsive

---

## Epic 11: Instellingen

### `PULSE-078` — Profiel instellingen pagina
**Omvang:** M
**Beschrijving:** Pagina om profielgegevens aan te passen.
**Acceptatiecriteria:**
- [x] `/settings` pagina
- [x] Profiel sectie: naam, gewicht, lengte, dieetvoorkeur
- [x] Koppelingen sectie: Hevy API key input + status indicator, Health Auto Export token + status
- [x] Targets sectie: eiwit per kg, wekelijkse training targets per sport
- [x] Save button per sectie
- [x] Succes/error feedback

### `PULSE-079` — Onboarding flow
**Omvang:** M
**Beschrijving:** Eerste-keer setup na registratie.
**Acceptatiecriteria:**
- [x] Stappen wizard na eerste login:
  1. Profiel basics (naam, gewicht, lengte)
  2. Sport voorkeuren (welke sporten, frequentie targets)
  3. Koppelingen (Hevy API key, Health Auto Export uitleg)
  4. Doelen (optioneel, 1-3 eerste doelen)
- [x] Overslaan mogelijk per stap
- [x] Data opgeslagen in `profiles`, `user_settings`, `goals`
- [x] Na voltooiing: redirect naar dashboard

---

## Epic 12: Schema Generatie (via Chat)

### `PULSE-080` — Schema generatie prompt
**Omvang:** M
**Beschrijving:** Claude prompt voor trainingsschema generatie.
**Acceptatiecriteria:**
- [x] `src/lib/ai/prompts/schema-generation.ts`
- [x] Prompt die Claude instrueert om:
  - Een trainingsschema te genereren als gestructureerd JSON
  - Te variëren t.o.v. vorige schema's
  - Rekening te houden met doelen, blessures, progressie
  - Realistische gewichten te kiezen op basis van progressie data
- [x] Output format: compatible met `training_schemas.workout_schedule`

### `PULSE-081` — Schema generatie flow in chat
**Omvang:** L
**Beschrijving:** Volledige flow voor schema generatie via de chat agent.
**Acceptatiecriteria:**
- [x] Gebruiker vraagt om nieuw schema via chat
- [x] Context assembler stuurt vorige schema's + progressie mee
- [x] Claude genereert schema als gestructureerd JSON
- [x] Schema wordt getoond in chat als leesbare tabel/overzicht
- [x] Gebruiker kan bevestigen ("ziet er goed uit") of aanpassen ("meer focus op pull")
- [x] Na bevestiging: opslaan in `training_schemas`, vorige schema deactiveren
- [x] Schema block summary aanmaken voor het vorige schema

---

## Epic 13: Polish & Optimalisatie

### `PULSE-082` — Loading states
**Omvang:** S
**Beschrijving:** Voeg skeleton loaders toe aan alle pagina's.
**Acceptatiecriteria:**
- [x] Skeleton componenten voor elk dashboard component
- [x] Skeleton voor charts
- [x] Skeleton voor chat berichten
- [x] Consistent patroon (pulse animatie)

### `PULSE-083` — Error states
**Omvang:** S
**Beschrijving:** Voeg error states toe.
**Acceptatiecriteria:**
- [x] Error boundary per pagina
- [x] Gebruikersvriendelijke error berichten
- [x] Retry buttons waar relevant
- [x] "Kon data niet laden" states voor individuele componenten

### `PULSE-084` — Empty states
**Omvang:** S
**Beschrijving:** States voor wanneer er nog geen data is.
**Acceptatiecriteria:**
- [x] Dashboard zonder workouts: "Start je eerste workout om je dashboard te vullen"
- [x] Voeding zonder logs: "Log je eerste maaltijd"
- [x] Trends zonder history: "Nog niet genoeg data voor trends"
- [x] Consistent design patroon

### `PULSE-085` — Mobile optimalisatie
**Omvang:** M
**Beschrijving:** Fijnafstelling van de mobiele ervaring.
**Acceptatiecriteria:**
- [x] Alle pagina's getest op 375px breed (iPhone SE)
- [x] Touch targets minimaal 44x44px
- [x] Geen horizontale scroll
- [x] Charts responsive en leesbaar op klein scherm
- [x] Bottom nav niet overlappend met content

### `PULSE-086` — Performance audit
**Omvang:** M
**Beschrijving:** Check en verbeter performance.
**Acceptatiecriteria:**
- [x] Lighthouse score >80 op alle pagina's
- [x] SSR waar mogelijk (Server Components)
- [x] SWR caching effectief
- [x] Geen onnodige re-renders
- [x] Database queries geoptimaliseerd (check EXPLAIN)

---

## Epic 14: Productie Launch

### `PULSE-087` — Vercel deployment configuratie
**Omvang:** S
**Beschrijving:** Configureer Vercel voor productie deployment.
**Acceptatiecriteria:**
- [x] `vercel.json` met cron configuratie
- [x] Environment variables in Vercel dashboard
- [ ] Custom domein (optioneel)
- [x] Build test succesvol

### `PULSE-088` — Supabase productie setup
**Omvang:** S
**Beschrijving:** Configureer Supabase voor productie.
**Acceptatiecriteria:**
- [x] Productie project in Supabase dashboard
- [x] Migraties gedraaid op productie
- [x] RLS policies actief
- [x] API keys in Vercel environment variables

### `PULSE-089` — Health Auto Export koppelen
**Omvang:** S
**Beschrijving:** Configureer Health Auto Export om naar Pulse te pushen.
**Acceptatiecriteria:**
- [x] Health Auto Export app geïnstalleerd op Stef's iPhone
- [x] REST endpoint geconfigureerd naar Pulse API
- [x] Auth token geconfigureerd
- [x] Test data succesvol ontvangen
- [ ] Export interval ingesteld (bijv. elke 30 min)

### `PULSE-090` — Hevy API koppelen
**Omvang:** S
**Beschrijving:** Koppel Stef's Hevy account.
**Acceptatiecriteria:**
- [x] Hevy Pro geactiveerd
- [x] API key gegenereerd
- [x] API key opgeslagen in Pulse settings
- [x] Initiële sync succesvol
- [x] Historische workouts geïmporteerd

### `PULSE-091` — End-to-end test met echte data
**Omvang:** M
**Beschrijving:** Test de hele flow met echte data.
**Acceptatiecriteria:**
- [x] Hevy workouts verschijnen in dashboard
- [x] Apple Health data (runs, padel, activiteit) wordt verwerkt
- [x] Aggregaties worden correct berekend
- [x] Chat agent heeft toegang tot echte data
- [x] Voedingsanalyse werkt
- [x] Alle pagina's tonen relevante data

---

## Totaaloverzicht

| Epic | Stories | Geschatte totaal |
|---|---|---|
| 0: Project Setup | PULSE-001 t/m 014 | ~12 uur |
| 1: Layout & Navigatie | PULSE-015 t/m 018 | ~3 uur |
| 2: Hevy API | PULSE-019 t/m 024 | ~6 uur |
| 3: Apple Health | PULSE-025 t/m 027 | ~4 uur |
| 4: Aggregatie Engine | PULSE-028 t/m 035 | ~8 uur |
| 5: Dashboard | PULSE-036 t/m 043 | ~8 uur |
| 6: Progressie Tab | PULSE-044 t/m 050 | ~7 uur |
| 7: Voeding Tab | PULSE-051 t/m 058 | ~7 uur |
| 8: Chat Agent | PULSE-059 t/m 070 | ~12 uur |
| 9: Doelen | PULSE-071 t/m 073 | ~4 uur |
| 10: Trends Tab | PULSE-074 t/m 077 | ~4 uur |
| 11: Instellingen | PULSE-078 t/m 079 | ~4 uur |
| 12: Schema Generatie | PULSE-080 t/m 081 | ~4 uur |
| 13: Polish | PULSE-082 t/m 086 | ~6 uur |
| 14: Productie Launch | PULSE-087 t/m 091 | ~5 uur |
| **Totaal** | **91 stories** | **~94 uur** |

Dat is roughly 12 werkdagen van 8 uur, of 6 weken bij 2-3 avonden per week van 2-3 uur.
