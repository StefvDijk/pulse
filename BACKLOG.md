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
- [ ] Next.js 14+ project met App Router en TypeScript
- [ ] pnpm als package manager
- [ ] Tailwind CSS geconfigureerd
- [ ] ESLint + Prettier geconfigureerd
- [ ] `tsconfig.json` met strict mode
- [ ] `.env.local.example` met alle benodigde variabelen (leeg)
- [ ] `pnpm dev` start zonder errors
- [ ] Git repo geïnitialiseerd met `.gitignore`

### `PULSE-002` — Tailwind design tokens configureren
**Omvang:** XS
**Beschrijving:** Voeg de kleur tokens, typografie, en spacing uit de PRD toe aan Tailwind config.
**Acceptatiecriteria:**
- [ ] Custom colors in `tailwind.config.ts` (bg-primary, bg-secondary, accent-primary, sport-gym, etc.)
- [ ] Custom font family (Inter via Google Fonts of next/font)
- [ ] Dark mode als default (geen toggle)
- [ ] Voorbeeld pagina die alle kleuren toont (tijdelijk, voor verificatie)

### `PULSE-003` — Supabase project koppelen
**Omvang:** S
**Beschrijving:** Maak Supabase client configuratie aan. Lokaal én remote.
**Acceptatiecriteria:**
- [ ] `supabase init` gedraaid
- [ ] `src/lib/supabase/client.ts` — browser client (met `NEXT_PUBLIC_` keys)
- [ ] `src/lib/supabase/server.ts` — server client (voor Server Components en Route Handlers)
- [ ] `src/lib/supabase/admin.ts` — service role client (voor API routes die RLS bypassen)
- [ ] `.env.local` gevuld met Supabase credentials
- [ ] Connectie getest (simpele query)

### `PULSE-004` — Database migratie: Core tabellen
**Omvang:** M
**Beschrijving:** Maak de eerste migratie aan met de kern-tabellen.
**Acceptatiecriteria:**
- [ ] Migratie `001_initial_schema.sql` met: `profiles`, `user_settings`, `workouts`, `exercise_definitions`, `workout_exercises`, `workout_sets`
- [ ] Migratie draait zonder errors
- [ ] Types gegenereerd naar `src/types/database.ts`

### `PULSE-005` — Database migratie: Runs, Padel, Activity
**Omvang:** S
**Beschrijving:** Voeg tabellen toe voor hardlopen, padel, en dagelijkse activiteit.
**Acceptatiecriteria:**
- [ ] Migratie `002_activity_tables.sql` met: `runs`, `padel_sessions`, `daily_activity`
- [ ] Types opnieuw gegenereerd

### `PULSE-006` — Database migratie: Voeding tabellen
**Omvang:** S
**Beschrijving:** Voeg voeding-gerelateerde tabellen toe.
**Acceptatiecriteria:**
- [ ] Migratie `003_nutrition_tables.sql` met: `nutrition_logs`, `daily_nutrition_summary`
- [ ] Types opnieuw gegenereerd

### `PULSE-007` — Database migratie: Chat & Blessures
**Omvang:** S
**Beschrijving:** Voeg chat en blessure tabellen toe.
**Acceptatiecriteria:**
- [ ] Migratie `004_chat_injury_tables.sql` met: `chat_messages`, `chat_sessions`, `injury_logs`
- [ ] Types opnieuw gegenereerd

### `PULSE-008` — Database migratie: Schema's & Doelen
**Omvang:** S
**Beschrijving:** Voeg trainingsschema en doelen tabellen toe.
**Acceptatiecriteria:**
- [ ] Migratie `005_schema_goals_tables.sql` met: `training_schemas`, `schema_block_summaries`, `goals`, `personal_records`
- [ ] Types opnieuw gegenereerd

### `PULSE-009` — Database migratie: Aggregatie tabellen
**Omvang:** S
**Beschrijving:** Voeg de aggregatie tabellen toe.
**Acceptatiecriteria:**
- [ ] Migratie `006_aggregation_tables.sql` met: `daily_aggregations`, `weekly_aggregations`, `monthly_aggregations`
- [ ] Types opnieuw gegenereerd

### `PULSE-010` — Database migratie: Indexen
**Omvang:** XS
**Beschrijving:** Voeg performance indexen toe.
**Acceptatiecriteria:**
- [ ] Migratie `007_indexes.sql` met alle indexen uit PRD sectie 5.2
- [ ] Migratie draait zonder errors

### `PULSE-011` — Database migratie: Row Level Security
**Omvang:** M
**Beschrijving:** Configureer RLS policies voor alle tabellen.
**Acceptatiecriteria:**
- [ ] Migratie `008_rls_policies.sql`
- [ ] RLS enabled op alle tabellen
- [ ] Policy per tabel: users can only CRUD own data (WHERE auth.uid() = user_id)
- [ ] Getest: query zonder auth retourneert 0 rows
- [ ] Getest: query met auth retourneert alleen eigen data

### `PULSE-012` — Supabase Auth configureren
**Omvang:** S
**Beschrijving:** Configureer authenticatie.
**Acceptatiecriteria:**
- [ ] Email/password auth enabled in Supabase dashboard
- [ ] `src/app/auth/login/page.tsx` — simpel login formulier
- [ ] `src/app/auth/signup/page.tsx` — simpel registratie formulier
- [ ] Auth middleware die onbeveiligde routes redirect naar login
- [ ] Na registratie: automatisch profiel aangemaakt in `profiles` tabel (via Supabase trigger of API)
- [ ] Na login: redirect naar dashboard

### `PULSE-013` — Seed data: Exercise definities
**Omvang:** M
**Beschrijving:** Seed de `exercise_definitions` tabel met de ~40 meest voorkomende exercises.
**Acceptatiecriteria:**
- [ ] Script `scripts/seed-exercises.ts` dat de exercise mappings uit PRD sectie 9.2 insert
- [ ] Draait via `pnpm run seed:exercises`
- [ ] Idempotent (kan meerdere keren draaien zonder duplicaten)
- [ ] Alle exercises hebben correcte muscle groups en movement patterns

### `PULSE-014` — Seed data: Test data voor development
**Omvang:** M
**Beschrijving:** Genereer realistische test data zodat je het dashboard kunt ontwikkelen zonder echte API koppelingen.
**Acceptatiecriteria:**
- [ ] Script `scripts/seed-test-data.ts`
- [ ] Genereert 8 weken aan:
  - Gym workouts (3x/week, variërende oefeningen en gewichten met lichte progressie)
  - Runs (2x/week, variërende afstand en pace)
  - Padel sessies (1x/week)
  - Dagelijkse activiteit (stappen, calorieën, hartslag)
  - Voedingslogs (2-3 maaltijden per dag, sommige dagen leeg)
  - Dagelijkse en wekelijkse aggregaties
- [ ] Data is realistisch (geen 500kg bench press, geen 2 min/km pace)
- [ ] Draait via `pnpm run seed:testdata`

---

## Epic 1: Layout & Navigatie

### `PULSE-015` — Root layout met dark theme
**Omvang:** S
**Beschrijving:** Maak het root layout met dark background, font, en meta tags.
**Acceptatiecriteria:**
- [ ] `src/app/layout.tsx` met dark bg, Inter font, viewport meta
- [ ] HTML `<html>` element heeft `class="dark"` en dark background
- [ ] Paginatitel: "Pulse"
- [ ] Favicon (simpel, tijdelijk)

### `PULSE-016` — Bottom navigation (mobiel)
**Omvang:** M
**Beschrijving:** Maak de mobiele bottom navigation bar.
**Acceptatiecriteria:**
- [ ] `src/components/layout/Navigation.tsx`
- [ ] 5 tab items: Dashboard, Progressie, Voeding, Trends, Chat
- [ ] Iconen (Lucide icons)
- [ ] Active state highlighting (accent kleur)
- [ ] Fixed aan onderkant van het scherm
- [ ] Alleen zichtbaar op mobiel (<1024px)
- [ ] Navigeert correct naar elke route

### `PULSE-017` — Sidebar navigatie (desktop)
**Omvang:** S
**Beschrijving:** Maak de desktop sidebar.
**Acceptatiecriteria:**
- [ ] Sidebar in `Navigation.tsx` (responsieve variant)
- [ ] Zichtbaar op desktop (>=1024px)
- [ ] Zelfde items als bottom nav
- [ ] Collapsed/expanded state (optioneel voor v1)
- [ ] Logo/app naam bovenaan

### `PULSE-018` — Lege pagina scaffolds
**Omvang:** XS
**Beschrijving:** Maak lege pagina's aan voor alle routes met een placeholder titel.
**Acceptatiecriteria:**
- [ ] `/` → "Dashboard"
- [ ] `/progress` → "Progressie"
- [ ] `/nutrition` → "Voeding"
- [ ] `/trends` → "Trends"
- [ ] `/chat` → "Chat"
- [ ] `/goals` → "Doelen"
- [ ] `/settings` → "Instellingen"
- [ ] Navigatie werkt naar alle pagina's

---

## Epic 2: Data Ingest — Hevy API

### `PULSE-019` — Hevy API client
**Omvang:** M
**Beschrijving:** Bouw een client voor de Hevy API.
**Acceptatiecriteria:**
- [ ] `src/lib/hevy/client.ts` met functies:
  - `getWorkouts(since?: Date, page?: number)` — haalt workouts op
  - `getWorkout(id: string)` — haalt één workout op met details
  - `getExerciseTemplates()` — haalt exercise definities op
  - `getRoutines()` — haalt routines op
- [ ] Zod schema's voor alle API responses
- [ ] Error handling (rate limits, auth errors)
- [ ] API key uit `user_settings` tabel
- [ ] Getest met een echte API call (als Stef zijn key heeft)

### `PULSE-020` — Hevy data mappers
**Omvang:** M
**Beschrijving:** Map Hevy API responses naar het Pulse database schema.
**Acceptatiecriteria:**
- [ ] `src/lib/hevy/mappers.ts`:
  - `mapHevyWorkout(hevy: HevyWorkout) → { workout, exercises, sets }`
  - `mapHevyExercise(hevy: HevyExercise) → ExerciseDefinition`
- [ ] Fuzzy matching van Hevy exercise namen naar `exercise_definitions`
- [ ] Onbekende exercises worden gelogd (console.warn + optioneel in een `unmapped_exercises` tabel)
- [ ] Unit tests voor de mapping functies

### `PULSE-021` — Hevy sync service
**Omvang:** M
**Beschrijving:** Service die nieuwe Hevy workouts ophaalt en opslaat.
**Acceptatiecriteria:**
- [ ] `src/lib/hevy/sync.ts`:
  - `syncWorkouts(userId: string)` — haalt alle workouts op sinds `last_hevy_sync_at`, mapt en slaat op
  - Deduplicatie op `hevy_workout_id`
  - Update `last_hevy_sync_at` na succesvolle sync
- [ ] Getest met test data

### `PULSE-022` — Hevy sync API route
**Omvang:** S
**Beschrijving:** API endpoint om Hevy sync te triggeren.
**Acceptatiecriteria:**
- [ ] `POST /api/ingest/hevy/sync` — triggert sync voor ingelogde gebruiker
- [ ] Auth check (Supabase session)
- [ ] Response: `{ synced: number, errors: string[] }`

### `PULSE-023` — Hevy sync cron job
**Omvang:** S
**Beschrijving:** Periodieke automatische sync via Vercel Cron.
**Acceptatiecriteria:**
- [ ] `GET /api/cron/hevy-sync` — synct alle gebruikers met een Hevy API key
- [ ] Beveiligd met `CRON_SECRET`
- [ ] Vercel cron configuratie in `vercel.json` (elke 15 min)
- [ ] Error logging per gebruiker (één failing user blokkeert niet de rest)

### `PULSE-024` — Hevy webhook endpoint
**Omvang:** S
**Beschrijving:** Webhook voor real-time workout notificaties van Hevy.
**Acceptatiecriteria:**
- [ ] `POST /api/ingest/hevy/webhook`
- [ ] Webhook signature verificatie
- [ ] Bij `workout.completed` event: sync die specifieke workout
- [ ] Response: 200 OK

---

## Epic 3: Data Ingest — Apple Health

### `PULSE-025` — Apple Health parser
**Omvang:** M
**Beschrijving:** Parse het JSON formaat van Health Auto Export.
**Acceptatiecriteria:**
- [ ] `src/lib/apple-health/parser.ts`
- [ ] Documenteer het verwachte JSON formaat (of onderzoek via Health Auto Export docs)
- [ ] Zod schema voor de payload
- [ ] Parse functies per datatype: `parseWorkouts()`, `parseActivitySummary()`, `parseHeartRate()`, `parseHRV()`
- [ ] Categoriseer workouts: running vs. padel vs. overig (op basis van workout type string)

### `PULSE-026` — Apple Health mappers
**Omvang:** M
**Beschrijving:** Map Apple Health data naar Pulse schema.
**Acceptatiecriteria:**
- [ ] `src/lib/apple-health/mappers.ts`:
  - `mapRun(ahWorkout) → Run`
  - `mapPadelSession(ahWorkout) → PadelSession`
  - `mapDailyActivity(ahSummary) → DailyActivity`
- [ ] Deduplicatie logica (op `apple_health_id`)
- [ ] Intensiteit classificatie voor padel (op basis van gemiddelde hartslag)

### `PULSE-027` — Apple Health ingest endpoint
**Omvang:** M
**Beschrijving:** API endpoint waar Health Auto Export naartoe pusht.
**Acceptatiecriteria:**
- [ ] `POST /api/ingest/apple-health`
- [ ] Bearer token authenticatie (`HEALTH_EXPORT_AUTH_TOKEN`)
- [ ] Parse payload → categoriseer → map → opslaan
- [ ] Deduplicatie (upsert op apple_health_id)
- [ ] Response: `{ processed: { runs: n, padel: n, activity: n }, errors: [] }`
- [ ] Trigger aggregatie herberekening voor betreffende dagen

---

## Epic 4: Aggregatie Engine

### `PULSE-028` — Spiergroep belasting berekening
**Omvang:** M
**Beschrijving:** Bereken spiergroep belasting per workout.
**Acceptatiecriteria:**
- [ ] `src/lib/aggregations/muscle-groups.ts`
- [ ] `calculateMuscleLoad(workout)` functie per PRD sectie 9.3
- [ ] Primary muscle = 100% volume, secondary = 50%
- [ ] Normalisatie naar 0-100 schaal
- [ ] Getest met voorbeeld workouts

### `PULSE-029` — Bewegingspatroon classificatie
**Omvang:** S
**Beschrijving:** Bereken volume per bewegingspatroon.
**Acceptatiecriteria:**
- [ ] `src/lib/aggregations/movement-patterns.ts`
- [ ] `calculateMovementVolume(workout)` → `{ push: n, pull: n, squat: n, hinge: n, ... }`
- [ ] Volume = totaal aantal sets per patroon

### `PULSE-030` — Dagelijkse aggregatie
**Omvang:** M
**Beschrijving:** Bereken de dagelijkse aggregatie voor een specifieke datum.
**Acceptatiecriteria:**
- [ ] `src/lib/aggregations/daily.ts`
- [ ] `computeDailyAggregation(userId, date)`:
  - Totale trainingsminuten (gym + run + padel)
  - Totaal sets, reps, tonnage
  - Totale running km
  - Spiergroep belasting (JSON)
  - Bewegingspatroon volume (JSON)
  - Training load score (gewogen combinatie)
  - Is rest day (boolean)
- [ ] Upsert naar `daily_aggregations`

### `PULSE-031` — Training load score berekening
**Omvang:** S
**Beschrijving:** Definieer hoe de training load score berekend wordt.
**Acceptatiecriteria:**
- [ ] `src/lib/aggregations/workload.ts`
- [ ] Training load per dag = gewogen combinatie van:
  - Gym: tonnage × duur factor
  - Running: afstand × pace factor × duur
  - Padel: duur × intensiteit factor
- [ ] Documenteer de weging en redenering in comments

### `PULSE-032` — Wekelijkse aggregatie
**Omvang:** M
**Beschrijving:** Bereken de wekelijkse aggregatie.
**Acceptatiecriteria:**
- [ ] `src/lib/aggregations/weekly.ts`
- [ ] `computeWeeklyAggregation(userId, weekStart)`:
  - Sum van daily totalen
  - Sessie counts per sport
  - Acute load (gemiddelde daily load deze week)
  - Chronic load (gemiddelde daily load afgelopen 4 weken)
  - Acute:chronic ratio + status (low/optimal/warning/danger)
  - Schema adherence (geplande vs. voltooide sessies)
  - Voeding gemiddelden (als er nutrition logs zijn)
- [ ] Upsert naar `weekly_aggregations`

### `PULSE-033` — Maandelijkse aggregatie
**Omvang:** M
**Beschrijving:** Bereken de maandelijkse aggregatie.
**Acceptatiecriteria:**
- [ ] `src/lib/aggregations/monthly.ts`
- [ ] `computeMonthlyAggregation(userId, month, year)`:
  - Totalen over alle weken
  - Strength highlights (beste lifts, progressie)
  - Running highlights
  - PRs van die maand
  - Gemiddelden
- [ ] Upsert naar `monthly_aggregations`

### `PULSE-034` — Aggregatie API route
**Omvang:** S
**Beschrijving:** API endpoint om aggregaties te herberekenen.
**Acceptatiecriteria:**
- [ ] `POST /api/aggregations/compute` met `{ type, date }`
- [ ] Kan daily, weekly, of monthly herberekenen
- [ ] Auth check

### `PULSE-035` — Aggregatie cron jobs
**Omvang:** S
**Beschrijving:** Automatische aggregatie berekening.
**Acceptatiecriteria:**
- [ ] `GET /api/cron/daily-aggregate` — elke nacht om 02:00, berekent gisteren
- [ ] `GET /api/cron/weekly-aggregate` — elke maandag om 03:00, berekent vorige week
- [ ] Beveiligd met `CRON_SECRET`
- [ ] Vercel cron configuratie

---

## Epic 5: Dashboard — Weekoverzicht

### `PULSE-036` — Dashboard layout
**Omvang:** S
**Beschrijving:** Maak de grid layout voor de dashboard pagina.
**Acceptatiecriteria:**
- [ ] Mobiel: single column, cards gestapeld
- [ ] Desktop: 2-3 kolommen grid
- [ ] Placeholder cards voor elk dashboard component
- [ ] Pull-to-refresh (optioneel, of refresh button)

### `PULSE-037` — Dashboard data hook
**Omvang:** M
**Beschrijving:** Custom hook die alle dashboard data ophaalt.
**Acceptatiecriteria:**
- [ ] `src/hooks/useDashboardData.ts`
- [ ] Haalt op via SWR:
  - Wekelijkse aggregatie (huidige week)
  - Dagelijkse aggregaties (deze week, 7 entries)
  - Actief trainingsschema
  - Workouts van deze week (voor adherence)
- [ ] Loading state, error state
- [ ] Auto-refresh elke 60 seconden

### `PULSE-038` — Workload Meter component
**Omvang:** M
**Beschrijving:** Semi-circulaire gauge die de acute:chronic ratio toont.
**Acceptatiecriteria:**
- [ ] `src/components/dashboard/WorkloadMeter.tsx`
- [ ] SVG gauge met gekleurde zones (groen/geel/rood)
- [ ] Ratio getal groot in het midden
- [ ] Status tekst eronder ("Optimaal", "Iets meer dan gewoonlijk", etc.)
- [ ] Animatie bij laden (optioneel)
- [ ] Props: `ratio: number`, `status: string`

### `PULSE-039` — Spiergroep Heatmap component
**Omvang:** L
**Beschrijving:** Body outline met gekleurde spiergroepen.
**Acceptatiecriteria:**
- [ ] `src/components/dashboard/MuscleHeatmap.tsx`
- [ ] SVG body outline (voor- en achterkant)
- [ ] Elke spiergroep is een apart SVG path dat gekleurd kan worden
- [ ] Kleur op basis van belasting (transparant → blauw → oranje → rood)
- [ ] Tap op spiergroep toont tooltip met detail (welke oefeningen, hoeveel sets)
- [ ] Props: `muscleLoad: Record<string, number>`
- [ ] Responsive (schaalt mee met container)

### `PULSE-040` — Sport Split component
**Omvang:** S
**Beschrijving:** Overzicht van trainingsuren per sport.
**Acceptatiecriteria:**
- [ ] `src/components/dashboard/SportSplit.tsx`
- [ ] Drie horizontale bars (gym paars, running cyaan, padel amber)
- [ ] Sessie count + totale duur per sport
- [ ] Target indicators (geplande sessies als outline)
- [ ] Props: `gymMinutes, runningMinutes, padelMinutes, targets`

### `PULSE-041` — Adherence Tracker component
**Omvang:** M
**Beschrijving:** Week visualisatie van geplande vs. gedane trainingen.
**Acceptatiecriteria:**
- [ ] `src/components/dashboard/AdherenceTracker.tsx`
- [ ] 7 cirkels (Ma-Zo)
- [ ] Leeg = geen training gepland
- [ ] Grijs outline = gepland maar niet gedaan
- [ ] Gekleurd (per sport) = voltooid
- [ ] Props: `schedule, completedWorkouts`

### `PULSE-042` — Training Block Indicator component
**Omvang:** S
**Beschrijving:** Toon waar je zit in je trainingsblok.
**Acceptatiecriteria:**
- [ ] `src/components/dashboard/TrainingBlockIndicator.tsx`
- [ ] Progressie bar (week X van Y)
- [ ] Label: schema naam + fase (opbouw, piek, deload)
- [ ] Link naar schema detail (of modal)
- [ ] Props: `schemaTitle, currentWeek, totalWeeks, phase`

### `PULSE-043` — Dashboard pagina assembleren
**Omvang:** S
**Beschrijving:** Combineer alle dashboard componenten op de home pagina.
**Acceptatiecriteria:**
- [ ] Alle componenten geïntegreerd in `/` pagina
- [ ] Data hook gekoppeld aan componenten
- [ ] Loading skeletons tijdens laden
- [ ] Werkt op mobiel en desktop
- [ ] Realistisch resultaat met test data

---

## Epic 6: Progressie Tab

### `PULSE-044` — Progressie data hook
**Omvang:** S
**Beschrijving:** Hook voor progressie data.
**Acceptatiecriteria:**
- [ ] `src/hooks/useProgressData.ts`
- [ ] Haalt op: wekelijkse aggregaties (range), PRs, doelen, run data
- [ ] Tijdsperiode parameter (4w, 3m, 6m, 1y)

### `PULSE-045` — Strength progressie chart
**Omvang:** M
**Beschrijving:** Line chart met kracht per bewegingspatroon over tijd.
**Acceptatiecriteria:**
- [ ] `src/components/progress/StrengthChart.tsx`
- [ ] Recharts LineChart met meerdere lijnen (push, pull, squat, hinge)
- [ ] Y-as: estimated 1RM (Epley formule) of totaal volume
- [ ] X-as: weken
- [ ] Tijdsperiode tabs (4w, 3m, 6m, 1y)
- [ ] Tooltip met details bij hover/tap
- [ ] Legenda met sport-kleuren

### `PULSE-046` — Running progressie chart
**Omvang:** M
**Beschrijving:** Combinatie chart voor running data.
**Acceptatiecriteria:**
- [ ] `src/components/progress/RunningChart.tsx`
- [ ] Bars: wekelijks volume (km)
- [ ] Lijn: gemiddelde pace (sec/km)
- [ ] Tijdsperiode tabs
- [ ] Recharts ComposedChart

### `PULSE-047` — Volume trend chart
**Omvang:** M
**Beschrijving:** Stacked bar chart met totaal trainingsvolume per sport.
**Acceptatiecriteria:**
- [ ] `src/components/progress/VolumeChart.tsx`
- [ ] Recharts StackedBarChart
- [ ] Gestapeld per sport (gym, running, padel)
- [ ] Overlay lijn: acute:chronic ratio
- [ ] Wekelijkse resolutie

### `PULSE-048` — Personal Records lijst
**Omvang:** M
**Beschrijving:** Lijst van personal records.
**Acceptatiecriteria:**
- [ ] `src/components/progress/PRList.tsx`
- [ ] Kaarten gesorteerd op datum (nieuwste eerst)
- [ ] Per PR: exercise naam, waarde, datum, delta vs. vorig record
- [ ] Filter: per sport/categorie
- [ ] Highlight voor PRs van afgelopen week

### `PULSE-049` — Goal Progress kaarten
**Omvang:** M
**Beschrijving:** Voortgangskaarten per doel op de progressie pagina.
**Acceptatiecriteria:**
- [ ] `src/components/progress/GoalProgress.tsx`
- [ ] Per doel: titel, huidige waarde, target, progressie bar, deadline
- [ ] Categorie badge (strength/running/padel/nutrition)
- [ ] Mini sparkline van voortgang over tijd (optioneel v1, placeholder OK)

### `PULSE-050` — Progressie pagina assembleren
**Omvang:** S
**Beschrijving:** Combineer alle progressie componenten.
**Acceptatiecriteria:**
- [ ] Alle charts en lijsten geïntegreerd op `/progress`
- [ ] Tabbed layout of scroll sections
- [ ] Responsive
- [ ] Werkt met test data

---

## Epic 7: Voeding Tab

### `PULSE-051` — Voedingsanalyse prompt
**Omvang:** S
**Beschrijving:** Schrijf de Claude prompt voor voedingsanalyse.
**Acceptatiecriteria:**
- [ ] `src/lib/ai/prompts/nutrition-analysis.ts`
- [ ] System prompt die Claude instrueert om:
  - Natural language voedingsinput te analyseren
  - Geschatte calorieën, eiwit, koolhydraten, vet, vezels te retourneren
  - Confidence level (low/medium/high) aan te geven
  - Maaltijdtype te classificeren
- [ ] Output als gestructureerd JSON
- [ ] Vegetarisch-bewust (Stef eet grotendeels vegetarisch)

### `PULSE-052` — Voedingsanalyse API route
**Omvang:** M
**Beschrijving:** API endpoint voor voedingsanalyse.
**Acceptatiecriteria:**
- [ ] `POST /api/nutrition/analyze`
- [ ] Body: `{ input: string, date?: string, time?: string }`
- [ ] Roept Claude API aan met nutrition prompt
- [ ] Parse Claude response naar gestructureerde data
- [ ] Sla op in `nutrition_logs`
- [ ] Herbereken `daily_nutrition_summary`
- [ ] Response: `{ calories, protein_g, carbs_g, fat_g, fiber_g, analysis, confidence, meal_type }`

### `PULSE-053` — Nutrition Input component
**Omvang:** M
**Beschrijving:** Natural language input veld voor voeding.
**Acceptatiecriteria:**
- [ ] `src/components/nutrition/NutritionInput.tsx`
- [ ] Tekstveld met placeholder: "Wat heb je gegeten?"
- [ ] Submit button
- [ ] Loading state tijdens analyse
- [ ] Na submit: toon resultaat als kaart onder het input veld
- [ ] Resultaat kaart: maaltijd tekst + geschatte macro's + confidence badge

### `PULSE-054` — Macro Summary component
**Omvang:** M
**Beschrijving:** Dag overzicht van macro's.
**Acceptatiecriteria:**
- [ ] `src/components/nutrition/MacroSummary.tsx`
- [ ] Donut chart (eiwit, koolhydraten, vet) met Recharts PieChart
- [ ] Targets als buitenring of referentielijn
- [ ] Totale calorieën als getal in het midden
- [ ] Props: `{ calories, protein, carbs, fat, targets }`

### `PULSE-055` — Protein Tracker component
**Omvang:** S
**Beschrijving:** Prominente eiwit voortgangsbalk.
**Acceptatiecriteria:**
- [ ] `src/components/nutrition/ProteinTracker.tsx`
- [ ] Horizontale balk: huidige intake vs. target
- [ ] Kleur: rood als <70% target, geel als 70-90%, groen als >=90%
- [ ] Label: "92g / 130g eiwit"

### `PULSE-056` — Day Status Indicator
**Omvang:** S
**Beschrijving:** Globale dag-indicator voor voeding.
**Acceptatiecriteria:**
- [ ] `src/components/nutrition/DayIndicator.tsx`
- [ ] Kleur badge (groen/geel/rood) met korte tekst
- [ ] Logica: op basis van eiwit target + calorie range
- [ ] Tekst voorbeelden: "Je zit goed vandaag", "Je mist nog ~40g eiwit"

### `PULSE-057` — Maaltijden lijst
**Omvang:** S
**Beschrijving:** Chronologische lijst van alle maaltijden vandaag.
**Acceptatiecriteria:**
- [ ] Lijst onder de macro summary
- [ ] Per entry: tijd, raw input tekst, geschatte macro's compact
- [ ] Verwijder knop per entry

### `PULSE-058` — Voeding pagina assembleren
**Omvang:** S
**Beschrijving:** Combineer alle voeding componenten.
**Acceptatiecriteria:**
- [ ] Input bovenaan
- [ ] Day indicator
- [ ] Macro summary + protein tracker
- [ ] Maaltijden lijst
- [ ] Responsive

---

## Epic 8: Chat Agent

### `PULSE-059` — Claude API client
**Omvang:** S
**Beschrijving:** Configureer de Anthropic SDK client.
**Acceptatiecriteria:**
- [ ] `src/lib/ai/client.ts`
- [ ] Anthropic SDK client met API key
- [ ] Helper functie voor streaming responses
- [ ] Helper functie voor JSON mode responses
- [ ] Error handling wrapper

### `PULSE-060` — Chat system prompt
**Omvang:** M
**Beschrijving:** Schrijf de system prompt voor de chat agent.
**Acceptatiecriteria:**
- [ ] `src/lib/ai/prompts/chat-system.ts`
- [ ] Volledige system prompt per PRD sectie 6.5.2
- [ ] Nederlands als taal
- [ ] Rollen en capabilities duidelijk gedefinieerd
- [ ] Beperkingen benoemd

### `PULSE-061` — Vraag-type classifier
**Omvang:** M
**Beschrijving:** Classificeer gebruikersvragen voor de context assembler.
**Acceptatiecriteria:**
- [ ] `src/lib/ai/context-assembler.ts` (classificatie deel)
- [ ] `classifyQuestion(message: string): QuestionType`
- [ ] Types: nutrition_log, nutrition_question, injury_report, schema_request, progress_question, weekly_review, general_chat
- [ ] Keyword-based matching (geen extra Claude call nodig)
- [ ] Fallback: general_chat

### `PULSE-062` — Context assembler: data queries
**Omvang:** L
**Beschrijving:** Bouw de relevante data context per vraag-type.
**Acceptatiecriteria:**
- [ ] `src/lib/ai/context-assembler.ts` (data assembly deel)
- [ ] `assembleContext(userId, questionType): string`
- [ ] Per vraag-type: de juiste queries (zie PRD sectie 4.4)
- [ ] Output als geformatteerde tekst string (<8000 tokens)
- [ ] Compressie strategie per data type (zie PRD sectie 4.5)

### `PULSE-063` — Chat API route (streaming)
**Omvang:** M
**Beschrijving:** Streaming chat endpoint.
**Acceptatiecriteria:**
- [ ] `POST /api/chat`
- [ ] Body: `{ message: string, session_id?: string }`
- [ ] Classificeer vraag → assembleer context → stream Claude response
- [ ] Sla user message en assistant response op in `chat_messages`
- [ ] Maak of update `chat_sessions`
- [ ] Response: `text/event-stream`

### `PULSE-064` — Chat write-back: voeding
**Omvang:** S
**Beschrijving:** Als de chat agent voedingsdata genereert, sla het op.
**Acceptatiecriteria:**
- [ ] Detecteer in de chat response of er voedingsanalyse zit
- [ ] Zo ja: parse en sla op in `nutrition_logs`
- [ ] Herbereken `daily_nutrition_summary`

### `PULSE-065` — Chat write-back: blessure
**Omvang:** S
**Beschrijving:** Als de gebruiker een blessure meldt via chat, sla het op.
**Acceptatiecriteria:**
- [ ] Bij `injury_report` type: sla op in `injury_logs`
- [ ] Body location, beschrijving, AI analyse, aanbevelingen
- [ ] Link naar gerelateerde workouts

### `PULSE-066` — Chat Interface component
**Omvang:** M
**Beschrijving:** De chat UI.
**Acceptatiecriteria:**
- [ ] `src/components/chat/ChatInterface.tsx`
- [ ] Berichtenlijst met scroll
- [ ] User berichten rechts (blauw), assistant links (donker)
- [ ] Markdown rendering in berichten
- [ ] Auto-scroll naar nieuwste bericht
- [ ] Streaming tekst effect (letter voor letter verschijnen)

### `PULSE-067` — Chat Input component
**Omvang:** S
**Beschrijving:** Input veld voor chat.
**Acceptatiecriteria:**
- [ ] `src/components/chat/ChatInput.tsx`
- [ ] Tekstveld met submit button
- [ ] Enter = verstuur (Shift+Enter = newline)
- [ ] Disabled tijdens streaming response
- [ ] Auto-focus

### `PULSE-068` — Chat Suggestions component
**Omvang:** S
**Beschrijving:** Voorgestelde vragen.
**Acceptatiecriteria:**
- [ ] `src/components/chat/ChatSuggestions.tsx`
- [ ] 3-4 klikbare suggesties
- [ ] Context-afhankelijk (dag van de week, recent activity)
- [ ] Verdwijnen na eerste bericht
- [ ] Props: `onSelect(suggestion: string)`

### `PULSE-069` — Chat pagina assembleren
**Omvang:** S
**Beschrijving:** Combineer chat componenten op de chat pagina.
**Acceptatiecriteria:**
- [ ] Full page chat interface op `/chat`
- [ ] Chat sessie management (nieuw gesprek starten)
- [ ] Suggesties bij start
- [ ] Streaming werkt

### `PULSE-070` — Floating Mini Chat
**Omvang:** M
**Beschrijving:** Floating chat button + compact chat window op alle pagina's.
**Acceptatiecriteria:**
- [ ] `src/components/layout/MiniChat.tsx`
- [ ] Floating action button rechtsonder (boven bottom nav op mobiel)
- [ ] Klik = expand naar compact chat window (300x400px)
- [ ] Zelfde functionaliteit als full chat maar compact
- [ ] "Open volledig" link naar `/chat`
- [ ] Sluit bij klik buiten het window

---

## Epic 9: Doelen

### `PULSE-071` — Doel aanmaken formulier
**Omvang:** M
**Beschrijving:** Formulier om een nieuw doel aan te maken.
**Acceptatiecriteria:**
- [ ] `src/components/goals/GoalForm.tsx`
- [ ] Velden: titel, categorie (dropdown), target waarde + unit, deadline (optioneel)
- [ ] Validatie
- [ ] Submit slaat op in `goals` tabel

### `PULSE-072` — Doelen overzicht pagina
**Omvang:** M
**Beschrijving:** Pagina met alle doelen.
**Acceptatiecriteria:**
- [ ] `/goals` pagina
- [ ] Actieve doelen bovenaan (gesorteerd op prioriteit)
- [ ] Voltooide doelen onderaan (collapsed)
- [ ] Per doel: kaart met titel, progressie, deadline
- [ ] Acties: bewerken, pauzeren, voltooien, verwijderen

### `PULSE-073` — Goal auto-tracking
**Omvang:** M
**Beschrijving:** Automatisch doelen bijwerken op basis van nieuwe data.
**Acceptatiecriteria:**
- [ ] `src/lib/goals/auto-track.ts`
- [ ] Na elke data ingest: check of doelen geupdated moeten worden
- [ ] Strength doelen: update `current_value` op basis van e1RM
- [ ] Running doelen: update op basis van beste recente run
- [ ] Frequentie doelen: update op basis van wekelijkse sessie count
- [ ] Markeer als `completed` als target bereikt

---

## Epic 10: Trends Tab

### `PULSE-074` — Maand vergelijking component
**Omvang:** M
**Beschrijving:** Side-by-side vergelijking van huidige vs. vorige maand.
**Acceptatiecriteria:**
- [ ] `src/components/trends/MonthComparison.tsx`
- [ ] Twee kaarten naast elkaar
- [ ] Metrics: sessies, tonnage, km, eiwit gemiddelde
- [ ] Delta's met pijlen en percentages (groen omhoog, rood omlaag)

### `PULSE-075` — Kwartaal vergelijking component
**Omvang:** M
**Beschrijving:** Kwartaal-over-kwartaal vergelijking.
**Acceptatiecriteria:**
- [ ] `src/components/trends/QuarterComparison.tsx`
- [ ] Zelfde structuur als maand maar over 3 maanden
- [ ] Extra: strength highlights (beste lifts van het kwartaal)

### `PULSE-076` — "Een jaar geleden" snapshot
**Omvang:** S
**Beschrijving:** Wat deed je een jaar geleden?
**Acceptatiecriteria:**
- [ ] `src/components/trends/YearAgoSnapshot.tsx`
- [ ] Haal data op van dezelfde week vorig jaar
- [ ] Toon als kaart met vergelijking: "Een jaar geleden: bench 55kg, nu 70kg (+27%)"
- [ ] Placeholder als niet genoeg data

### `PULSE-077` — Trends pagina assembleren
**Omvang:** S
**Beschrijving:** Combineer trend componenten.
**Acceptatiecriteria:**
- [ ] Maand vergelijking bovenaan
- [ ] Kwartaal daaronder
- [ ] "Een jaar geleden" onderaan
- [ ] Responsive

---

## Epic 11: Instellingen

### `PULSE-078` — Profiel instellingen pagina
**Omvang:** M
**Beschrijving:** Pagina om profielgegevens aan te passen.
**Acceptatiecriteria:**
- [ ] `/settings` pagina
- [ ] Profiel sectie: naam, gewicht, lengte, dieetvoorkeur
- [ ] Koppelingen sectie: Hevy API key input + status indicator, Health Auto Export token + status
- [ ] Targets sectie: eiwit per kg, wekelijkse training targets per sport
- [ ] Save button per sectie
- [ ] Succes/error feedback

### `PULSE-079` — Onboarding flow
**Omvang:** M
**Beschrijving:** Eerste-keer setup na registratie.
**Acceptatiecriteria:**
- [ ] Stappen wizard na eerste login:
  1. Profiel basics (naam, gewicht, lengte)
  2. Sport voorkeuren (welke sporten, frequentie targets)
  3. Koppelingen (Hevy API key, Health Auto Export uitleg)
  4. Doelen (optioneel, 1-3 eerste doelen)
- [ ] Overslaan mogelijk per stap
- [ ] Data opgeslagen in `profiles`, `user_settings`, `goals`
- [ ] Na voltooiing: redirect naar dashboard

---

## Epic 12: Schema Generatie (via Chat)

### `PULSE-080` — Schema generatie prompt
**Omvang:** M
**Beschrijving:** Claude prompt voor trainingsschema generatie.
**Acceptatiecriteria:**
- [ ] `src/lib/ai/prompts/schema-generation.ts`
- [ ] Prompt die Claude instrueert om:
  - Een trainingsschema te genereren als gestructureerd JSON
  - Te variëren t.o.v. vorige schema's
  - Rekening te houden met doelen, blessures, progressie
  - Realistische gewichten te kiezen op basis van progressie data
- [ ] Output format: compatible met `training_schemas.workout_schedule`

### `PULSE-081` — Schema generatie flow in chat
**Omvang:** L
**Beschrijving:** Volledige flow voor schema generatie via de chat agent.
**Acceptatiecriteria:**
- [ ] Gebruiker vraagt om nieuw schema via chat
- [ ] Context assembler stuurt vorige schema's + progressie mee
- [ ] Claude genereert schema als gestructureerd JSON
- [ ] Schema wordt getoond in chat als leesbare tabel/overzicht
- [ ] Gebruiker kan bevestigen ("ziet er goed uit") of aanpassen ("meer focus op pull")
- [ ] Na bevestiging: opslaan in `training_schemas`, vorige schema deactiveren
- [ ] Schema block summary aanmaken voor het vorige schema

---

## Epic 13: Polish & Optimalisatie

### `PULSE-082` — Loading states
**Omvang:** S
**Beschrijving:** Voeg skeleton loaders toe aan alle pagina's.
**Acceptatiecriteria:**
- [ ] Skeleton componenten voor elk dashboard component
- [ ] Skeleton voor charts
- [ ] Skeleton voor chat berichten
- [ ] Consistent patroon (pulse animatie)

### `PULSE-083` — Error states
**Omvang:** S
**Beschrijving:** Voeg error states toe.
**Acceptatiecriteria:**
- [ ] Error boundary per pagina
- [ ] Gebruikersvriendelijke error berichten
- [ ] Retry buttons waar relevant
- [ ] "Kon data niet laden" states voor individuele componenten

### `PULSE-084` — Empty states
**Omvang:** S
**Beschrijving:** States voor wanneer er nog geen data is.
**Acceptatiecriteria:**
- [ ] Dashboard zonder workouts: "Start je eerste workout om je dashboard te vullen"
- [ ] Voeding zonder logs: "Log je eerste maaltijd"
- [ ] Trends zonder history: "Nog niet genoeg data voor trends"
- [ ] Consistent design patroon

### `PULSE-085` — Mobile optimalisatie
**Omvang:** M
**Beschrijving:** Fijnafstelling van de mobiele ervaring.
**Acceptatiecriteria:**
- [ ] Alle pagina's getest op 375px breed (iPhone SE)
- [ ] Touch targets minimaal 44x44px
- [ ] Geen horizontale scroll
- [ ] Charts responsive en leesbaar op klein scherm
- [ ] Bottom nav niet overlappend met content

### `PULSE-086` — Performance audit
**Omvang:** M
**Beschrijving:** Check en verbeter performance.
**Acceptatiecriteria:**
- [ ] Lighthouse score >80 op alle pagina's
- [ ] SSR waar mogelijk (Server Components)
- [ ] SWR caching effectief
- [ ] Geen onnodige re-renders
- [ ] Database queries geoptimaliseerd (check EXPLAIN)

---

## Epic 14: Productie Launch

### `PULSE-087` — Vercel deployment configuratie
**Omvang:** S
**Beschrijving:** Configureer Vercel voor productie deployment.
**Acceptatiecriteria:**
- [ ] `vercel.json` met cron configuratie
- [ ] Environment variables in Vercel dashboard
- [ ] Custom domein (optioneel)
- [ ] Build test succesvol

### `PULSE-088` — Supabase productie setup
**Omvang:** S
**Beschrijving:** Configureer Supabase voor productie.
**Acceptatiecriteria:**
- [ ] Productie project in Supabase dashboard
- [ ] Migraties gedraaid op productie
- [ ] RLS policies actief
- [ ] API keys in Vercel environment variables

### `PULSE-089` — Health Auto Export koppelen
**Omvang:** S
**Beschrijving:** Configureer Health Auto Export om naar Pulse te pushen.
**Acceptatiecriteria:**
- [ ] Health Auto Export app geïnstalleerd op Stef's iPhone
- [ ] REST endpoint geconfigureerd naar Pulse API
- [ ] Auth token geconfigureerd
- [ ] Test data succesvol ontvangen
- [ ] Export interval ingesteld (bijv. elke 30 min)

### `PULSE-090` — Hevy API koppelen
**Omvang:** S
**Beschrijving:** Koppel Stef's Hevy account.
**Acceptatiecriteria:**
- [ ] Hevy Pro geactiveerd
- [ ] API key gegenereerd
- [ ] API key opgeslagen in Pulse settings
- [ ] Initiële sync succesvol
- [ ] Historische workouts geïmporteerd

### `PULSE-091` — End-to-end test met echte data
**Omvang:** M
**Beschrijving:** Test de hele flow met echte data.
**Acceptatiecriteria:**
- [ ] Hevy workouts verschijnen in dashboard
- [ ] Apple Health data (runs, padel, activiteit) wordt verwerkt
- [ ] Aggregaties worden correct berekend
- [ ] Chat agent heeft toegang tot echte data
- [ ] Voedingsanalyse werkt
- [ ] Alle pagina's tonen relevante data

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
