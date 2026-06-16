# Data-zichtbaarheid & multi-sport — ontwerp

- **Datum:** 2026-06-16
- **Status:** Goedgekeurd (brainstorm) → klaar voor implementatieplan
- **Branch/worktree:** `worktree-multisport-data-visibility` (off `origin/main`)
- **Eigenaar:** Stef (product owner) + engineer (Claude)

## 1. Aanleiding

Drie wensen van Stef, na onderzoek van de huidige code geverifieerd:

1. **Rust-HR** is zichtbaar met een streepje (`—`) in de frontend en lijkt niet mee te tellen in de readiness.
2. Er is **data die we binnenhalen maar niet (goed) tonen**; welke is relevant?
3. **Sporten binnenhalen moet beter**: Strava én Apple-workouts. Als Stef een lange wandeling, tennis, HIIT, voetbal, squash of yoga doet, moet dat duidelijk op het home-scherm verschijnen — nu verdwijnt het of wordt het verkeerd gelabeld.

### Bevindingen uit de code (samengevat)

**Rust-HR.** Wordt wél geparset (`src/lib/apple-health/parser.ts:188`, `parseActivitySummary`) en opgeslagen in `daily_activity.resting_heart_rate` (`src/lib/apple-health/mappers.ts:150`). Twee losse oorzaken:
- *Streepje in de health-bar:* `GET /api/health/today` (`route.ts:48-55`) pakt de **enkele nieuwste `daily_activity`-rij** (`order by date desc limit 1`). Stappen stromen de hele dag binnen, dus de nieuwste rij is "vandaag", maar Apple berekent rust-HR 's nachts (loopt ~1 dag achter). De nieuwste rij heeft dus stappen maar `resting_heart_rate = null` → streepje, terwijl gisteren's waarde wél in de DB staat. Geen per-metric fallback.
- *Telt niet mee in score:* `calculateReadinessScore` gebruikt z-scores; `zScore` geeft `null` tot er een baseline is met ≥10 samples (`src/lib/readiness/score.ts:75-81`). Geen/dunne baseline ⇒ bijdrage 0. Bewust ontwerp, maar voelt als negeren.

**Verborgen/onderbenutte data.**
- Slaapfases (deep/rem/light/awake), efficiency, bedtijden — net toegevoegd (sleep-score branch); health-bar toont alleen totaal.
- Body-comp: `visceral_fat_level`, `body_water_pct`, `bmr_kcal` opgeslagen (`extended-parser.ts:268-288`) maar niet in `BodyCompositionCard` (die toont gewicht/vetmassa/spiermassa).
- `daily_activity.active_minutes`, `stand_hours`, `total_calories` zijn kolommen die de HAE-parser **nooit vult** (`mappers.ts:155-157` zetten ze hard op `null`); Apple's Move/Exercise/Stand-ringen halen we dus niet binnen.
- Niet binnengehaald (wel via HAE beschikbaar): VO2max, ademhalingsfrequentie, SpO2, hartslagherstel, wandel-HR.
- Strava cadence/snelheid/elevation/polyline: volledig opgeslagen in `strava_activities`, alleen voor runs benut.

**Multi-sport (de grootste).**
- Geen generiek activiteiten-model: één tabel per sport — `workouts` (gym/Hevy), `runs`, `walks`, `padel_sessions`.
- `categorizeWorkout` (`src/lib/apple-health/types.ts:194`) kent 4 bakjes: running / walking / padel / **other**. Tennis/squash vallen nu onterecht in de **padel**-bak; HIIT/voetbal/yoga/fietsen/zwemmen vallen in **other** → `parsedOther` wordt **nergens opgeslagen** (alleen een debug-teller, ingest `route.ts:712`). Verdwijnt dus.
- Strava: `syncStravaActivities` haalt álles op en bewaart het compleet in `strava_activities`, maar promoveert alleen `Run/TrailRun/VirtualRun → runs` (`derive-runs.ts:12`) en `Walk/Hike → walks` (`derive-walks.ts:11`). Een Strava-rit/tennis/HIIT/zwemsessie staat in de DB maar is onzichtbaar.
- Weergave hardcoded op een kleine, inconsistente set:
  - Feed `RecentActivities`: types `gym|run|padel|walk`; metric alleen voor gym (tonnage) en run/walk (afstand·pace).
  - Weekstrip `WeekGlance` + `/api/schema/week`: tokens alléén `gym|run|padel` (`useSchemaWeek.ts:27`, `schema/week/route.ts:60`), query alleen `workouts/runs/padel_sessions` (`route.ts:257-277`). Wandelingen/tennis/HIIT komen niet in "DEZE WEEK".
  - Sport-kleuren op ≥3 plekken los gedefinieerd → drift t.o.v. design-tokens.
- `Sport = gym|run|padel` (`src/lib/constants.ts`), gesloten union, op veel plekken vertakt.

## 2. Doelen & niet-doelen

**Doelen**
- Elke sport die Stef doet (en in principe élke sport) verschijnt netjes op het home-scherm (feed + weekstrip), met juist label/icoon/kleur/metric.
- Rust-HR toont een eerlijke waarde i.p.v. een streepje wanneer er recent data is, en de readiness-drilldown legt uit wanneer rust-HR nog "ijkt".
- Reeds opgeslagen, relevante data wordt zichtbaar.
- Eén canonieke bron voor sport-presentatie (geen drift meer).

**Niet-doelen (nu)**
- De nieuwe sporten laten meetellen in belasting (ACWR) en readiness — **bewust uitgesteld naar een latere fase** (keuze Stef).
- `runs`/`workouts`/`walks`/`padel_sessions` migreren naar één tabel — we kiezen **hybride** (zie §3).
- Multi-tenant/100-user concerns (single-user focus).

## 3. Kernbeslissingen

| # | Beslissing | Keuze |
|---|------------|-------|
| D1 | Datamodel | **Hybride.** `runs` + `gym (Hevy)` blijven met hun rijke features. Eén nieuwe generieke **`activities`**-tabel voor alle overige sporten. |
| D2 | `walks` & `padel_sessions` | Blijven eigen tabel (al first-class). Tennis/squash worden uit de padel-bak gehaald naar `activities`. |
| D3 | Belasting/readiness-koppeling | **Latere fase** — eerst zichtbaar maken. `loadModel` wordt wel alvast in de registry vastgelegd. |
| D4 | Presentatie | Eén **sport-registry** als single source of truth; alle UI-mappings verwijzen ernaar. |
| D5 | Q2-afbakening | Vooral **ontsluiten** wat al opgeslagen is; alleen Apple-ringen (en optioneel VO2max) zijn nieuwe ingest. |

## 4. Architectuur

### 4.1 Sport-registry (keystone)

Nieuw: `src/lib/sports/registry.ts`. Eén getypeerde map, één `SportKey`-union.

```ts
export type SportKey =
  | 'gym' | 'run' | 'walk' | 'padel'
  | 'tennis' | 'squash' | 'hiit' | 'football' | 'yoga'
  | 'cycle' | 'swim' | 'other'

export interface SportMeta {
  key: SportKey
  label: string                 // NL, bv. 'Tennis', 'Wandeling'
  icon: LucideIcon              // lucide component
  colorBase: string             // uit tokens.js
  colorLight: string
  loadModel: 'tonnage' | 'run-acwr' | 'duration-hr' | 'none' // haak voor latere fase
}
```

- **`classify(rawName: string, source: 'apple'|'strava'|'hevy'|'manual'): SportKey`** — mapt Apple-workoutnaam én Strava `sport_type`/`type` naar een `SportKey` (NL + EN keywords). Onbekend → `'other'`. Vervangt `categorizeWorkout`, `classifySport`, `classifyByTitle`.
- **`primaryMetric(item): string | null`** — de subtitel-regel in de feed, per sport: tonnage (gym), afstand·pace (run/walk/cycle), duur·gem.HR/intensiteit (tennis/squash/hiit/football/yoga/swim). Pure functie van een genormaliseerd activity-item.
- **Kleurtoewijzing** (uit `design/design_handoff_pulse_v2/tokens.js`; gecentraliseerd dus triviaal te tweaken — icoon is primaire differentiator):

  | sport | base | herkomst |
  |-------|------|----------|
  | gym | `#00E5C7` | token sport.gym |
  | run | `#FF5E3A` | token sport.run |
  | padel | `#FFB020` | token sport.padel |
  | cycle | `#9CFF4F` | token sport.cycle |
  | walk | `#22D67A` | status.good (groen) |
  | tennis | `#4FC3F7` | cool-gradient (sky) |
  | squash | `#7C3AED` | gradient (purple) |
  | hiit | `#FF2D87` | gradient (magenta, "intens") |
  | football | `#9CFF4F` | deelt lime (icoon onderscheidt) |
  | yoga | `#7C3AED` | deelt purple (icoon onderscheidt) |
  | swim | `#4FC3F7` | deelt sky (icoon onderscheidt) |
  | other | `#A0A4B0` | neutraal grijs (huidige fallback) |

- Vervangt de losse mappings in `RecentActivities` (ICONS/accent/metric), `WeekGlance`/`SportGlyph`, `SportDot`/`SPORT_BASE`, `WeekAtAGlance` (legacy, mogelijk dead), `useSchemaWeek`/`schema/week`-`classifyByTitle`.

### 4.2 Generieke `activities`-tabel

Nieuwe migratie `supabase/migrations/<ts>_activities.sql`:

```sql
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sport_key text not null,                 -- registry-key
  source text not null,                    -- 'apple_health' | 'strava' | 'manual'
  apple_health_id text,
  strava_activity_id bigint,
  name text,                               -- originele label
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer,
  distance_meters integer,
  calories_burned integer,
  avg_heart_rate integer,
  max_heart_rate integer,
  elevation_gain_meters integer,
  intensity text,                          -- light|moderate|high (uit HR)
  raw jsonb,
  created_at timestamptz not null default now()
);
-- dedup
create unique index activities_user_apple on activities(user_id, apple_health_id) where apple_health_id is not null;
create unique index activities_user_strava on activities(user_id, strava_activity_id) where strava_activity_id is not null;
create index activities_user_started on activities(user_id, started_at desc);
-- RLS: per-user select/insert/update/delete (zoals andere tabellen)
```

- Na migratie types regenereren: `supabase gen types typescript --local > src/types/database.ts`.
- `runs`/`workouts`/`walks`/`padel_sessions` ongemoeid (D1/D2).

### 4.3 Ingest

**Apple/HAE** (`src/lib/apple-health/*`, `src/app/api/ingest/apple-health/route.ts`):
- `parseWorkouts` gebruikt registry-`classify` i.p.v. `categorizeWorkout`.
- Routing: running→`runs`, walking→`walks`, gym→Hevy-correlatie (ongewijzigd), **al het overige → `activities`** met juiste `sport_key` + intensiteit (hergebruik `classifyIntensity`).
- `parsedOther` wordt **gemapt en geüpsert** i.p.v. weggegooid. Nieuwe mapper `mapActivity()`.
- Dedup/upsert op `(user_id, apple_health_id)`, zelfde patroon als runs/walks.

**Strava** (`src/lib/strava/sync.ts` + nieuw `src/lib/strava/derive-activities.ts`):
- `deriveRunsFromStrava` / `deriveWalksFromStrava` blijven.
- Nieuw `deriveActivitiesFromStrava`: alle `strava_activities` met een `activity_type`/`sport_type` buiten run/walk/hike → `activities` via `classify`. Idempotent, dedup op `strava_activity_id`.
- (Nice-to-have, kan fase-2) cross-source match Apple↔Strava in tijdvenster om dubbeltelling te voorkomen.

### 4.4 Weergave

**Feed** (`src/app/api/activities/route.ts`, `src/components/home/RecentActivities.tsx`):
- 5e bron: query `activities`. `ActivityType` → `SportKey`. Genormaliseerd via registry.
- `RecentActivities` haalt icoon/kleur/metric uit registry. Onbekende sport → generiek icoon + eigen naam, breekt nooit.

**Weekstrip** (`src/app/api/schema/week/route.ts`, `src/hooks/useSchemaWeek.ts`, `src/components/dashboard/v2/WeekGlance.tsx`):
- `/api/schema/week`: week-query uitbreiden met `walks` + `activities` (naast `workouts/runs/padel_sessions`).
- `ActivityToken.type` → `SportKey`; `classifyByTitle` → registry. `SportGlyph` → registry-icoon.
- Resultaat: een lange wandeling, tennismatch, HIIT, voetbal etc. verschijnt als pill op de juiste dag in "DEZE WEEK" (`done-extra` token wanneer niet gepland).

### 4.5 Rust-HR (Q1)

- **Streepje-fix:** `GET /api/health/today` resolvet rust-HR (en HRV) per metric uit de **laatste dag mét een waarde** i.p.v. één nieuwste rij. UI toont subtiele "(gisteren)"-hint bij stale waarde. Spiegelt de today→gisteren-fallback die `computeReadiness` al heeft (`readiness.ts:187`).
- **Diagnose:** rust-HR/HRV-aanwezigheid loggen bij ingest (uitbreiding bestaande metric-log). Als HAE de metric niet stuurt → HAE-config-stap, documenteren (geen codefix nodig/mogelijk).
- **Score-eerlijkheid:** readiness-drilldown toont "rust-HR: nog aan het ijken (x/10 dagen)" wanneer baseline `<10` samples, zodat afwezige bijdrage verklaarbaar is.
- **Bewust niet:** general `heart_rate` als rust-HR gebruiken (≠ resting; niet fabriceren).

### 4.6 Verborgen data zichtbaar (Q2)

- **Slaapdetail:** stages/efficiency/bedtijden tonen — **afstemmen met lopende `sleep-score` branch**, niet dubbel bouwen. (Coördinatiepunt, geen losse migratie.)
- **Body-comp extra's:** visceraal vet, lichaamswater %, BMR toevoegen aan `BodyCompositionCard` (uitklap/"meer").
- **Apple-ringen:** `apple_exercise_time` + stand ingesten → bestaande lege kolommen `active_minutes`/`stand_hours` vullen + tonen in health-bar. (Kleine parser-uitbreiding.)
- **Optioneel/stretch:** VO2max-trend ingesten + tonen.

## 5. Fasering

Elke fase = eigen reviewbare, los te shippen stap. Tests-first (per project-regels, 80%+).

- **Fase 0 — Registry + types.** Bouw `src/lib/sports/registry.ts`; refactor bestaande UI (gym/run/padel/walk) om eruit te lezen. **Pure refactor, geen gedragswijziging** — volledig testbaar als baseline.
- **Fase 1 — `activities`-tabel + Apple-ingest.** Migratie + RLS; `classify`; tennis/squash-fix; `other` niet meer droppen; `mapActivity`.
- **Fase 2 — Strava derive-activities.** Niet-run/walk Strava zichtbaar maken.
- **Fase 3 — Feed + weekstrip tonen alle sporten.** `/api/activities` + `RecentActivities`; `/api/schema/week` + `WeekGlance`.
- **Fase 4 — Rust-HR display-fallback + drilldown-eerlijkheid.**
- **Fase 5 — Verborgen data.** Slaapdetail (afstemmen), body-comp extra's, Apple-ringen-ingest.
- **Fase 6 — (LATER, niet nu) belasting/ACWR + readiness** voor nieuwe sporten (`duration-hr` load-model).

## 6. Testaanpak

- **Unit:** registry `classify` (Apple/Strava namen NL+EN → key), `primaryMetric` per sport, rust-HR per-metric fallback-resolver, `mapActivity`.
- **Integratie:** ingest-route routeert "other" naar `activities` (Apple); `deriveActivitiesFromStrava` idempotent; `/api/activities` union incl. `activities`; `/api/schema/week` bevat walks + activities-tokens.
- **Regressie:** fase 0 verandert niets aan bestaande feed/weekstrip-output (snapshot vóór/na).

## 7. Risico's & open punten

- **Weekstrip-tokenlogica** (`schema/week/route.ts`) is plan-vs-realiteit en niet triviaal; uitbreiden naar generieke sporten vergt zorg met `done-extra`/`done-swap`-states.
- **Asymmetrie** padel/walks (eigen tabel) vs tennis/squash (generiek) — geaccepteerd; registry verbergt het in de UI.
- **Cross-source dubbeltelling** Apple↔Strava voor `activities` (bv. dezelfde tennismatch via beide) — match-in-tijdvenster als nice-to-have in fase 2.
- **Sleep-score branch overlap** — fase 5 slaapdetail moet daarmee samengevoegd, niet gedupliceerd.
- **Historische mislabeling** — eerder geïmporteerde tennis/squash staat nu in `padel_sessions`. Optionele eenmalige backfill (her-classificeren → `activities`) in fase 1; bij twijfel laten staan i.p.v. data verplaatsen.
- **Nieuwe-sport kleuren** — voorstel in §4.1; centraal, makkelijk bij te stellen.
- **HAE-configafhankelijkheid** rust-HR — als de metric niet wordt geëxporteerd is het geen codefix.
