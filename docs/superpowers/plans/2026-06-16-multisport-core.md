# Multi-sport core (registry → activities → Apple ingest → feed/weekstrip) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Maak dat élke sport die Stef doet (wandeling, tennis, HIIT, voetbal, squash, yoga, …) correct wordt binnengehaald én zichtbaar wordt op het home-scherm (feed + weekstrip), via één canonieke sport-registry en een generieke `activities`-tabel.

**Architecture:** Hybride datamodel — `runs`/`workouts`/`walks`/`padel_sessions` blijven; nieuwe `activities`-tabel vangt alle overige sporten. Eén `src/lib/sports/registry.ts` is single source of truth voor sport-`classify`, icoon, kleur en metric; alle ingest- en UI-code leest daaruit. Fase 0 is een pure refactor (geen gedragswijziging); fase 1-3 voegen vangst + weergave toe.

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, Supabase (Postgres + RLS), vitest (`tests/**/*.test.ts`, `globals:false`, `@`→`src`), lucide-react, Tailwind. Tests draaien met `pnpm vitest run <pad>`; volledige suite `pnpm test`.

**Scope:** Dit plan = spec-fases 0-3 (Apple-kant volledig + feed + weekstrip + Strava-derive). Spec-fase 4 (rust-HR display) en fase 5 (verborgen data) krijgen eigen vervolgplannen. Spec: `docs/superpowers/specs/2026-06-16-data-visibility-multisport-design.md`.

**Vooraf (eenmalig):** `pnpm install` in de worktree, dan `pnpm test` als groene baseline. Bij rode baseline: melden en overleggen voor je begint.

---

## Bestandsstructuur

**Nieuw:**
- `src/lib/sports/registry.ts` — `SportKey`, `SportMeta`, `SPORT_META` map, kleuren, iconen, `loadModel`.
- `src/lib/sports/classify.ts` — `classifySport(rawName, source)` → `SportKey` (Apple + Strava + NL/EN keywords).
- `src/lib/sports/metric.ts` — `sportMetric(input)` → subtitel-string per sport (tonnage / afstand·pace / duur·HR).
- `src/lib/strava/derive-activities.ts` — niet-run/walk Strava → `activities`.
- `supabase/migrations/20260616000003_activities.sql` — tabel + RLS + indexen.
- Tests: `tests/lib/sports/classify.test.ts`, `tests/lib/sports/metric.test.ts`, `tests/lib/sports/registry.test.ts`, `tests/lib/apple-health/activities-parse.test.ts`, `tests/lib/strava/derive-activities.test.ts`.

**Gewijzigd:**
- `src/lib/apple-health/types.ts` — `ParsedActivity` type; `parseWorkouts` routeert via `classifySport`.
- `src/lib/apple-health/parser.ts` — `parseWorkouts` → `{ runs, walks, padel, activities }`.
- `src/lib/apple-health/mappers.ts` — nieuwe `mapActivity()`.
- `src/app/api/ingest/apple-health/route.ts` — upsert `activities`.
- `src/app/api/activities/route.ts` — 5e bron `activities`; `ActivityType` → `SportKey`.
- `src/components/home/RecentActivities.tsx` — icoon/kleur/metric uit registry.
- `src/components/dashboard/v2/WeekGlance.tsx` — `SportGlyph`/`TokenPill` uit registry.
- `src/hooks/useSchemaWeek.ts` + `src/app/api/schema/week/route.ts` — `ActivityToken.type` → `SportKey`; query incl. `walks` + `activities`; `classifyByTitle` → registry.
- `src/lib/strava/sync.ts` — roept `deriveActivitiesFromStrava` aan.
- `src/types/database.ts` — `activities`-tabeltype (via `supabase gen types`).

---

## FASE 0 — Sport-registry (keystone, pure refactor)

### Task 1: Registry-module met meta-map

**Files:**
- Create: `src/lib/sports/registry.ts`
- Test: `tests/lib/sports/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/sports/registry.test.ts
import { describe, it, expect } from 'vitest'
import { SPORT_META, SPORT_KEYS, type SportKey } from '@/lib/sports/registry'

describe('SPORT_META', () => {
  it('heeft een complete meta-entry voor elke SportKey', () => {
    for (const key of SPORT_KEYS) {
      const meta = SPORT_META[key]
      expect(meta, key).toBeDefined()
      expect(meta.key).toBe(key)
      expect(meta.label.length).toBeGreaterThan(0)
      expect(meta.colorBase).toMatch(/^#|rgb/)
      expect(meta.colorLight.length).toBeGreaterThan(0)
      expect(typeof meta.icon).toBe('object') // lucide icon is a forwardRef object/function
      expect(['tonnage', 'run-acwr', 'duration-hr', 'none']).toContain(meta.loadModel)
    }
  })

  it('behoudt de canonieke design-token kleuren', () => {
    expect(SPORT_META.gym.colorBase).toBe('#00E5C7')
    expect(SPORT_META.run.colorBase).toBe('#FF5E3A')
    expect(SPORT_META.padel.colorBase).toBe('#FFB020')
    expect(SPORT_META.cycle.colorBase).toBe('#9CFF4F')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/sports/registry.test.ts`
Expected: FAIL — cannot find module `@/lib/sports/registry`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/sports/registry.ts
import {
  Dumbbell, Footprints, Mountain, CircleDot, Bike, Waves,
  Flame, PersonStanding, Activity,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type SportKey =
  | 'gym' | 'run' | 'walk' | 'padel'
  | 'tennis' | 'squash' | 'hiit' | 'football' | 'yoga'
  | 'cycle' | 'swim' | 'other'

export type LoadModel = 'tonnage' | 'run-acwr' | 'duration-hr' | 'none'

export interface SportMeta {
  key: SportKey
  label: string
  icon: LucideIcon
  colorBase: string
  colorLight: string
  loadModel: LoadModel
}

const lt = (rgb: string) => `rgba(${rgb},0.18)`

export const SPORT_META: Record<SportKey, SportMeta> = {
  gym:      { key: 'gym',      label: 'Krachttraining', icon: Dumbbell,       colorBase: '#00E5C7', colorLight: lt('0,229,199'),  loadModel: 'tonnage' },
  run:      { key: 'run',      label: 'Hardlopen',      icon: Footprints,     colorBase: '#FF5E3A', colorLight: lt('255,94,58'),  loadModel: 'run-acwr' },
  walk:     { key: 'walk',     label: 'Wandeling',      icon: Mountain,       colorBase: '#22D67A', colorLight: lt('34,214,122'), loadModel: 'none' },
  padel:    { key: 'padel',    label: 'Padel',          icon: CircleDot,      colorBase: '#FFB020', colorLight: lt('255,176,32'), loadModel: 'duration-hr' },
  tennis:   { key: 'tennis',   label: 'Tennis',         icon: CircleDot,      colorBase: '#4FC3F7', colorLight: lt('79,195,247'), loadModel: 'duration-hr' },
  squash:   { key: 'squash',   label: 'Squash',         icon: CircleDot,      colorBase: '#7C3AED', colorLight: lt('124,58,237'), loadModel: 'duration-hr' },
  hiit:     { key: 'hiit',     label: 'HIIT',           icon: Flame,          colorBase: '#FF2D87', colorLight: lt('255,45,135'), loadModel: 'duration-hr' },
  football: { key: 'football', label: 'Voetbal',        icon: Activity,       colorBase: '#9CFF4F', colorLight: lt('156,255,79'), loadModel: 'duration-hr' },
  yoga:     { key: 'yoga',     label: 'Yoga',           icon: PersonStanding, colorBase: '#7C3AED', colorLight: lt('124,58,237'), loadModel: 'none' },
  cycle:    { key: 'cycle',    label: 'Fietsen',        icon: Bike,           colorBase: '#9CFF4F', colorLight: lt('156,255,79'), loadModel: 'run-acwr' },
  swim:     { key: 'swim',     label: 'Zwemmen',        icon: Waves,          colorBase: '#4FC3F7', colorLight: lt('79,195,247'), loadModel: 'duration-hr' },
  other:    { key: 'other',    label: 'Activiteit',     icon: Activity,       colorBase: '#A0A4B0', colorLight: lt('160,164,176'),loadModel: 'none' },
}

export const SPORT_KEYS = Object.keys(SPORT_META) as SportKey[]

export function sportMeta(key: SportKey): SportMeta {
  return SPORT_META[key] ?? SPORT_META.other
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/sports/registry.test.ts`
Expected: PASS. (Als tsc klaagt over een ontbrekend lucide-icoon: vervang door een bestaand icoon, bv. `Activity`.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/sports/registry.ts tests/lib/sports/registry.test.ts
git commit -m "feat(sports): canonieke sport-registry met meta + kleuren"
```

### Task 2: `classifySport` — Apple/Strava-namen → SportKey

**Files:**
- Create: `src/lib/sports/classify.ts`
- Test: `tests/lib/sports/classify.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/sports/classify.test.ts
import { describe, it, expect } from 'vitest'
import { classifySport } from '@/lib/sports/classify'

describe('classifySport', () => {
  it('herkent hardlopen (NL+EN, Apple+Strava)', () => {
    expect(classifySport('Outdoor Run', 'strava')).toBe('run')
    expect(classifySport('Hardlopen', 'apple')).toBe('run')
    expect(classifySport('Loopband', 'apple')).toBe('run')
    expect(classifySport('TrailRun', 'strava')).toBe('run')
  })
  it('herkent wandelen/hiken', () => {
    expect(classifySport('Walk', 'strava')).toBe('walk')
    expect(classifySport('Hiking', 'apple')).toBe('walk')
    expect(classifySport('Wandelen', 'apple')).toBe('walk')
  })
  it('scheidt racketsporten correct — tennis ≠ padel ≠ squash', () => {
    expect(classifySport('Tennis', 'apple')).toBe('tennis')
    expect(classifySport('Padel', 'apple')).toBe('padel')
    expect(classifySport('Squash', 'apple')).toBe('squash')
  })
  it('herkent gym als kracht, niet als hiit', () => {
    expect(classifySport('Traditional Strength Training', 'apple')).toBe('gym')
    expect(classifySport('Functional Strength Training', 'apple')).toBe('gym')
    expect(classifySport('Krachttraining', 'apple')).toBe('gym')
  })
  it('herkent hiit / voetbal / yoga / fietsen / zwemmen', () => {
    expect(classifySport('High Intensity Interval Training', 'apple')).toBe('hiit')
    expect(classifySport('Soccer', 'strava')).toBe('football')
    expect(classifySport('Voetbal', 'apple')).toBe('football')
    expect(classifySport('Yoga', 'apple')).toBe('yoga')
    expect(classifySport('Ride', 'strava')).toBe('cycle')
    expect(classifySport('Cycling', 'apple')).toBe('cycle')
    expect(classifySport('Pool Swim', 'apple')).toBe('swim')
  })
  it('valt terug op other bij onbekend', () => {
    expect(classifySport('Curling', 'apple')).toBe('other')
    expect(classifySport('', 'apple')).toBe('other')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/sports/classify.test.ts`
Expected: FAIL — module niet gevonden.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/sports/classify.ts
import type { SportKey } from '@/lib/sports/registry'

export type SportSource = 'apple' | 'strava' | 'hevy' | 'manual'

// Volgorde = prioriteit. Eerste match wint. Specifiek vóór generiek.
// Let op: gym ('strength'/'kracht') staat vóór niets dat met die woorden botst;
// hiit gebruikt 'high intensity'/'interval' zonder 'functional', zodat
// "Functional Strength Training" naar gym gaat, niet hiit.
const RULES: ReadonlyArray<readonly [SportKey, readonly string[]]> = [
  ['run',      ['hardlopen', 'rennen', 'loopband', 'treadmill', 'run', 'jog', 'joggen']],
  ['walk',     ['wandel', 'hike', 'hiking', 'walk']],
  ['cycle',    ['fiets', 'cycling', 'cycle', 'ride', 'bike', 'spinning']],
  ['swim',     ['zwem', 'swim', 'pool']],
  ['padel',    ['padel']],
  ['tennis',   ['tennis']],
  ['squash',   ['squash']],
  ['football', ['voetbal', 'soccer', 'football']],
  ['yoga',     ['yoga', 'pilates']],
  ['gym',      ['strength', 'kracht', 'weight training', 'gym', 'fitness']],
  ['hiit',     ['hiit', 'high intensity', 'interval', 'crossfit', 'bootcamp', 'cross training']],
]

export function classifySport(rawName: string | null | undefined, _source: SportSource): SportKey {
  const name = (rawName ?? '').toLowerCase().trim()
  if (!name) return 'other'
  for (const [key, keywords] of RULES) {
    if (keywords.some((kw) => name.includes(kw))) return key
  }
  return 'other'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/sports/classify.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sports/classify.ts tests/lib/sports/classify.test.ts
git commit -m "feat(sports): classifySport — Apple/Strava namen naar SportKey"
```

### Task 3: `sportMetric` — subtitel-regel per sport

**Files:**
- Create: `src/lib/sports/metric.ts`
- Test: `tests/lib/sports/metric.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/sports/metric.test.ts
import { describe, it, expect } from 'vitest'
import { sportMetric } from '@/lib/sports/metric'

describe('sportMetric', () => {
  it('gym → tonnage', () => {
    expect(sportMetric('gym', { totalVolumeKg: 3338 })).toBe('3.338 kg')
  })
  it('run/walk/cycle → afstand · pace', () => {
    expect(sportMetric('run', { distanceMeters: 7500, avgPaceSecondsPerKm: 393 })).toBe('7,5 km · 6:33/km')
    expect(sportMetric('walk', { distanceMeters: 4200 })).toBe('4,2 km')
  })
  it('duur-sporten → duur (+ HR indien aanwezig)', () => {
    expect(sportMetric('tennis', { durationSeconds: 5400, avgHeartRate: 132 })).toBe('90 min · 132 bpm')
    expect(sportMetric('hiit', { durationSeconds: 1800 })).toBe('30 min')
  })
  it('null als er niets te tonen valt', () => {
    expect(sportMetric('other', {})).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/sports/metric.test.ts`
Expected: FAIL — module niet gevonden.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/sports/metric.ts
import type { SportKey } from '@/lib/sports/registry'

export interface SportMetricInput {
  totalVolumeKg?: number | null
  distanceMeters?: number | null
  avgPaceSecondsPerKm?: number | null
  durationSeconds?: number | null
  avgHeartRate?: number | null
}

const km = (m: number) => `${(m / 1000).toFixed(1).replace('.', ',')} km`
const pace = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}/km`
const volume = (kg: number) => `${Math.round(kg).toLocaleString('nl-NL')} kg`
const minutes = (s: number) => `${Math.round(s / 60)} min`

const DISTANCE_SPORTS: ReadonlySet<SportKey> = new Set(['run', 'walk', 'cycle'])
const DURATION_SPORTS: ReadonlySet<SportKey> = new Set(['padel', 'tennis', 'squash', 'hiit', 'football', 'yoga', 'swim'])

export function sportMetric(key: SportKey, input: SportMetricInput): string | null {
  if (key === 'gym') {
    return input.totalVolumeKg && input.totalVolumeKg > 0 ? volume(input.totalVolumeKg) : null
  }
  if (DISTANCE_SPORTS.has(key)) {
    const parts: string[] = []
    if (input.distanceMeters != null) parts.push(km(input.distanceMeters))
    if (input.avgPaceSecondsPerKm != null) parts.push(pace(input.avgPaceSecondsPerKm))
    return parts.length ? parts.join(' · ') : null
  }
  if (DURATION_SPORTS.has(key)) {
    const parts: string[] = []
    if (input.durationSeconds != null && input.durationSeconds > 0) parts.push(minutes(input.durationSeconds))
    if (input.avgHeartRate != null) parts.push(`${input.avgHeartRate} bpm`)
    return parts.length ? parts.join(' · ') : null
  }
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/sports/metric.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sports/metric.ts tests/lib/sports/metric.test.ts
git commit -m "feat(sports): sportMetric — subtitel-regel per sport"
```

### Task 4: `RecentActivities` leest uit registry (geen gedragswijziging)

**Files:**
- Modify: `src/components/home/RecentActivities.tsx`

- [ ] **Step 1: Vervang de hardcoded `ICONS`, `accent`, `metric` door registry-calls.**

Vervang in `RecentActivities.tsx` de lokale `ICONS`-map, `accent()` en `metric()` door:

```tsx
import { sportMeta, type SportKey } from '@/lib/sports/registry'
import { sportMetric } from '@/lib/sports/metric'

function metric(activity: ActivityItem): string | null {
  return sportMetric(activity.type as SportKey, {
    totalVolumeKg: activity.total_volume_kg,
    distanceMeters: activity.distance_meters,
    avgPaceSecondsPerKm: activity.avg_pace_seconds_per_km,
    durationSeconds: activity.duration_seconds,
    avgHeartRate: activity.avg_heart_rate,
  })
}
```

In `ActivityRow`, vervang het icoon/kleur-blok:

```tsx
const meta = sportMeta(activity.type as SportKey)
const Icon = meta.icon
// ... gebruik meta.colorLight voor de cirkel-achtergrond en meta.colorBase voor de icoon-kleur
```

Verwijder de ongebruikte imports (`Dumbbell, Footprints, CircleDot, Mountain`, `SPORT_BASE, SPORT_LIGHT`).

- [ ] **Step 2: Verify — bestaande feed-output blijft identiek.**

Run: `pnpm test` (en open de app: `pnpm dev`, home-scherm). De feed toont gym (tonnage), run/walk (afstand·pace) exact als vóór. tsc-hook moet groen zijn.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/RecentActivities.tsx
git commit -m "refactor(home): RecentActivities leest icoon/kleur/metric uit sport-registry"
```

### Task 5: `WeekGlance` leest uit registry

**Files:**
- Modify: `src/components/dashboard/v2/WeekGlance.tsx`

- [ ] **Step 1: Vervang `SportGlyph` + pill-kleur door registry.**

In `WeekGlance.tsx`:

```tsx
import { sportMeta, type SportKey } from '@/lib/sports/registry'

function SportGlyph({ sport, size = 12, color }: { sport: SportKey; size?: number; color: string }) {
  const Icon = sportMeta(sport).icon
  return <Icon size={size} strokeWidth={2.4} color={color} />
}
```

In `TokenPill`: `background: sportMeta(tokenSport(token)).colorBase` i.p.v. `SPORT_BASE[sport]`. Pas `tokenSport` aan zodat het `SportKey` teruggeeft (`return t.type as SportKey`). Verwijder de directe `lucide` + `SPORT_BASE`-imports die niet meer nodig zijn.

- [ ] **Step 2: Verify — weekstrip ziet er identiek uit voor gym/run/padel.**

Run: `pnpm test`; check home-scherm "DEZE WEEK". tsc groen.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/v2/WeekGlance.tsx
git commit -m "refactor(home): WeekGlance leest sport-presentatie uit registry"
```

> **Checkpoint fase 0:** Registry is keystone, beide render-componenten lezen eruit, output ongewijzigd. `pnpm test` groen.

---

## FASE 1 — `activities`-tabel + Apple-ingest

### Task 6: Migratie — `activities`-tabel + RLS + indexen

**Files:**
- Create: `supabase/migrations/20260616000003_activities.sql`

- [ ] **Step 1: Schrijf de migratie.**

```sql
-- supabase/migrations/20260616000003_activities.sql
-- Generieke activiteiten-tabel voor sporten buiten runs/workouts/walks/padel_sessions.
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sport_key text not null,
  source text not null,
  apple_health_id text,
  strava_activity_id bigint,
  name text,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer,
  distance_meters integer,
  calories_burned integer,
  avg_heart_rate integer,
  max_heart_rate integer,
  elevation_gain_meters integer,
  intensity text,
  raw jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists activities_user_apple
  on public.activities (user_id, apple_health_id) where apple_health_id is not null;
create unique index if not exists activities_user_strava
  on public.activities (user_id, strava_activity_id) where strava_activity_id is not null;
create index if not exists activities_user_started
  on public.activities (user_id, started_at desc);

alter table public.activities enable row level security;

create policy "activities_select_own" on public.activities
  for select using (auth.uid() = user_id);
create policy "activities_insert_own" on public.activities
  for insert with check (auth.uid() = user_id);
create policy "activities_update_own" on public.activities
  for update using (auth.uid() = user_id);
create policy "activities_delete_own" on public.activities
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Pas toe op de lokale DB.**

Run: `supabase db push` (of `supabase migration up`). Verwacht: migratie slaagt, tabel `activities` bestaat.
> Let op (memory `env_local_is_prod`): draai dit tegen de **lokale** DB (127.0.0.1), nooit tegen prod. Controleer dat `supabase status` lokaal draait.

- [ ] **Step 3: Regenereer types.**

Run: `supabase gen types typescript --local > src/types/database.ts`
Verwacht: `Database['public']['Tables']['activities']` bestaat nu. (Lukt local gen niet, voeg het tabeltype handmatig toe met dezelfde kolommen als Row/Insert/Update.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260616000003_activities.sql src/types/database.ts
git commit -m "feat(db): activities-tabel + RLS voor generieke sporten"
```

### Task 7: Parser routeert "overige" workouts naar activities

**Files:**
- Modify: `src/lib/apple-health/types.ts` (nieuw `ParsedActivity` + `categorizeWorkout` → `classifySport`)
- Modify: `src/lib/apple-health/parser.ts` (`parseWorkouts` → `{ runs, walks, padel, activities }`)
- Test: `tests/lib/apple-health/activities-parse.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/apple-health/activities-parse.test.ts
import { describe, it, expect } from 'vitest'
import { parseWorkouts } from '@/lib/apple-health/parser'
import type { RawHealthPayload } from '@/lib/apple-health/types'

function payload(workouts: unknown[]): RawHealthPayload {
  return { data: { workouts, metrics: [] } } as unknown as RawHealthPayload
}

describe('parseWorkouts — generieke activities', () => {
  it('zet tennis in activities (niet padel) met sport_key tennis', () => {
    const p = parseWorkouts(payload([
      { id: 't1', name: 'Tennis', start: '2026-06-15T10:00:00Z', end: '2026-06-15T11:30:00Z', duration: 5400 },
    ]))
    expect(p.padel).toHaveLength(0)
    expect(p.activities).toHaveLength(1)
    expect(p.activities[0].sportKey).toBe('tennis')
    expect(p.activities[0].durationSeconds).toBe(5400)
  })
  it('vangt HIIT/voetbal/yoga in activities i.p.v. ze te droppen', () => {
    const p = parseWorkouts(payload([
      { id: 'h1', name: 'High Intensity Interval Training', start: '2026-06-15T07:00:00Z' },
      { id: 'v1', name: 'Voetbal', start: '2026-06-15T20:00:00Z' },
      { id: 'y1', name: 'Yoga', start: '2026-06-15T18:00:00Z' },
    ]))
    expect(p.activities.map((a) => a.sportKey).sort()).toEqual(['football', 'hiit', 'yoga'])
  })
  it('blijft runs/walks/padel correct splitsen', () => {
    const p = parseWorkouts(payload([
      { id: 'r1', name: 'Outdoor Run', start: '2026-06-15T06:00:00Z' },
      { id: 'w1', name: 'Wandelen', start: '2026-06-15T12:00:00Z' },
      { id: 'p1', name: 'Padel', start: '2026-06-15T19:00:00Z' },
    ]))
    expect(p.runs).toHaveLength(1)
    expect(p.walks).toHaveLength(1)
    expect(p.padel).toHaveLength(1)
    expect(p.activities).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/apple-health/activities-parse.test.ts`
Expected: FAIL — `activities`/`sportKey` bestaat niet op het resultaat.

- [ ] **Step 3: Implement — types + parser.**

In `src/lib/apple-health/types.ts`, voeg toe (en behoud `ParsedWorkout`):

```ts
import type { SportKey } from '@/lib/sports/registry'
// ...
export interface ParsedActivity extends ParsedWorkout {
  sportKey: SportKey
}
```

In `src/lib/apple-health/parser.ts`: importeer `classifySport`, en herschrijf `ParsedWorkouts` + `parseWorkouts`:

```ts
import { classifySport } from '@/lib/sports/classify'
import type { SportKey } from '@/lib/sports/registry'
import type { /* ... */, ParsedActivity } from '@/lib/apple-health/types'

export interface ParsedWorkouts {
  runs: ParsedRun[]
  walks: ParsedWalk[]
  padel: ParsedPadel[]
  activities: ParsedActivity[]
}

export function parseWorkouts(payload: RawHealthPayload): ParsedWorkouts {
  return payload.data.workouts.reduce<ParsedWorkouts>(
    (acc, raw) => {
      const parsed = parseRawWorkout(raw)
      const key: SportKey = classifySport(parsed.name, 'apple')
      if (key === 'run')   return { ...acc, runs:  [...acc.runs,  parsed as ParsedRun] }
      if (key === 'walk')  return { ...acc, walks: [...acc.walks, parsed as ParsedWalk] }
      if (key === 'padel') return { ...acc, padel: [...acc.padel, parsed as ParsedPadel] }
      // gym wordt apart afgehandeld via parseGymWorkouts (Hevy-correlatie) → niet als activity opslaan.
      if (key === 'gym')   return acc
      return { ...acc, activities: [...acc.activities, { ...parsed, sportKey: key }] }
    },
    { runs: [], walks: [], padel: [], activities: [] },
  )
}
```

(`parseRawWorkout` blijft ongewijzigd; `category` op `ParsedWorkout` mag blijven bestaan maar wordt niet meer gebruikt voor routing.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/apple-health/activities-parse.test.ts`
Expected: PASS. Draai ook `pnpm vitest run tests/lib/apple-health-walks.test.ts` om regressie uit te sluiten.

- [ ] **Step 5: Commit**

```bash
git add src/lib/apple-health/types.ts src/lib/apple-health/parser.ts tests/lib/apple-health/activities-parse.test.ts
git commit -m "feat(ingest): Apple-workouts classificeren via registry, overige naar activities"
```

### Task 8: `mapActivity` + ingest-route upsert

**Files:**
- Modify: `src/lib/apple-health/mappers.ts` (nieuwe `mapActivity`)
- Modify: `src/app/api/ingest/apple-health/route.ts` (upsert `activities`)
- Test: `tests/lib/apple-health/activities-parse.test.ts` (uitbreiden met mapper)

- [ ] **Step 1: Write the failing test (mapper).**

Voeg toe aan `tests/lib/apple-health/activities-parse.test.ts`:

```ts
import { mapActivity } from '@/lib/apple-health/mappers'

describe('mapActivity', () => {
  it('mapt een ParsedActivity naar een activities Insert met intensiteit uit HR', () => {
    const row = mapActivity(
      { appleHealthId: 't1', name: 'Tennis', category: 'other', sportKey: 'tennis',
        startedAt: '2026-06-15T10:00:00Z', endedAt: '2026-06-15T11:30:00Z',
        durationSeconds: 5400, distanceMeters: undefined, calories: 600,
        avgHeartRate: 150, maxHeartRate: 175 },
      'user-1',
    )
    expect(row.user_id).toBe('user-1')
    expect(row.sport_key).toBe('tennis')
    expect(row.source).toBe('apple_health')
    expect(row.apple_health_id).toBe('t1')
    expect(row.duration_seconds).toBe(5400)
    expect(row.avg_heart_rate).toBe(150)
    expect(row.intensity).toBe('moderate') // 140..155
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/apple-health/activities-parse.test.ts`
Expected: FAIL — `mapActivity` niet geëxporteerd.

- [ ] **Step 3: Implement `mapActivity`.**

In `src/lib/apple-health/mappers.ts` (hergebruik bestaande `classifyIntensity`):

```ts
import type { ParsedActivity } from '@/lib/apple-health/types'
type ActivityInsert = Database['public']['Tables']['activities']['Insert']

export function mapActivity(parsed: ParsedActivity, userId: string): ActivityInsert {
  return {
    user_id: userId,
    sport_key: parsed.sportKey,
    source: 'apple_health',
    apple_health_id: parsed.appleHealthId ?? null,
    strava_activity_id: null,
    name: parsed.name,
    started_at: parsed.startedAt,
    ended_at: parsed.endedAt ?? null,
    duration_seconds: parsed.durationSeconds != null ? Math.round(parsed.durationSeconds) : null,
    distance_meters: parsed.distanceMeters ?? null,
    calories_burned: parsed.calories != null ? Math.round(parsed.calories) : null,
    avg_heart_rate: parsed.avgHeartRate != null ? Math.round(parsed.avgHeartRate) : null,
    max_heart_rate: parsed.maxHeartRate != null ? Math.round(parsed.maxHeartRate) : null,
    elevation_gain_meters: null,
    intensity: classifyIntensity(parsed.avgHeartRate),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/apple-health/activities-parse.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire de ingest-route.**

In `src/app/api/ingest/apple-health/route.ts`:
- Import `mapActivity`.
- Vervang de destructuring: `const { runs: parsedRuns, walks: parsedWalks, padel: parsedPadel, activities: parsedActivities } = parseWorkouts(payload)`.
- Voeg ná het walks-blok een activities-blok toe dat upsert op `(user_id, apple_health_id)` (zonder id: dedup op `started_at` via bestaande check), `touchedDays.add(dayKeyAmsterdam(...))` per rij, en `activitiesProcessed` telt. Spiegel het walks-patroon (regels ~312-363).
- Voeg `activities: activitiesProcessed` toe aan de response `processed` en aan `totalDataIngested`.

```ts
let activitiesProcessed = 0
if (parsedActivities.length > 0) {
  const inserts = parsedActivities.map((a) => mapActivity(a, userId))
  const withId = inserts.filter((a) => a.apple_health_id)
  if (withId.length > 0) {
    const { error } = await supabase
      .from('activities')
      .upsert(withId, { onConflict: 'user_id,apple_health_id', ignoreDuplicates: false })
    if (error) { console.error('apple-health ingest: activities upsert error', error); errors.push(`Activities upsert failed: ${error.message}`) }
    else { activitiesProcessed += withId.length; for (const a of withId) { if (a.started_at) touchedDays.add(dayKeyAmsterdam(a.started_at)) } }
  }
}
```

- [ ] **Step 6: Verify build + commit.**

Run: `pnpm test` en `pnpm build` (tsc/Next). Verwacht: groen.

```bash
git add src/lib/apple-health/mappers.ts src/app/api/ingest/apple-health/route.ts tests/lib/apple-health/activities-parse.test.ts
git commit -m "feat(ingest): activities upsert in apple-health ingest"
```

> **Checkpoint fase 1:** Apple-workouts buiten run/walk/gym worden nu opgeslagen i.p.v. gedropt. Tennis/squash niet meer als padel.

---

## FASE 3a — Feed toont alle sporten

### Task 9: `/api/activities` voegt `activities`-bron toe

**Files:**
- Modify: `src/app/api/activities/route.ts`

- [ ] **Step 1: Widen `ActivityType` + voeg query toe.**

In `src/app/api/activities/route.ts`:
- `export type ActivityType = SportKey` (import uit registry) i.p.v. `Sport | 'walk'`.
- Voeg een 5e query toe in `Promise.all`: `activities` voor de user, `order by started_at desc limit 50`, selecteer alle kolommen.
- Map naar `ActivityItem`: `type: a.sport_key as ActivityType`, `title: a.name ?? sportMeta(a.sport_key).label`, plus `duration_seconds/distance_meters/avg_heart_rate/...`.
- Voeg `...activityItems` toe aan de merge-array vóór sort/paginate.

```ts
import { sportMeta, type SportKey } from '@/lib/sports/registry'
// in Promise.all:
admin.from('activities')
  .select('id, sport_key, name, started_at, duration_seconds, distance_meters, calories_burned, avg_heart_rate, max_heart_rate, elevation_gain_meters, intensity')
  .eq('user_id', user.id).order('started_at', { ascending: false }).limit(50),
// mapping:
const otherActivities: ActivityItem[] = (activitiesResult.data ?? []).map((a) => ({
  id: a.id,
  type: a.sport_key as ActivityType,
  title: a.name ?? sportMeta(a.sport_key as SportKey).label,
  started_at: a.started_at,
  duration_seconds: a.duration_seconds ?? null,
  calories_burned: a.calories_burned ?? null,
  avg_heart_rate: a.avg_heart_rate ?? null,
  max_heart_rate: a.max_heart_rate ?? null,
  distance_meters: a.distance_meters ?? null,
  elevation_gain_meters: a.elevation_gain_meters ?? null,
  intensity: a.intensity ?? null,
}))
```

- [ ] **Step 2: Verify — feed toont nu de nieuwe sporten.**

Run: `pnpm test`, `pnpm build`. Open home: een tennis/HIIT/voetbal-sessie verschijnt in "Recente activiteiten" met juist icoon/kleur (uit registry, fase 0) en metric (duur·HR).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/activities/route.ts
git commit -m "feat(home): feed toont generieke activities (alle sporten)"
```

> **Checkpoint (eerste demo-bare win):** Na Task 9 verschijnt elke Apple-sport in de feed. Goed moment om met Stef te reviewen.

---

## FASE 2 — Strava derive-activities

### Task 10: `deriveActivitiesFromStrava`

**Files:**
- Create: `src/lib/strava/derive-activities.ts`
- Test: `tests/lib/strava/derive-activities.test.ts`
- Modify: `src/lib/strava/sync.ts`

- [ ] **Step 1: Write the failing test** (classificatie-laag, puur).

```ts
// tests/lib/strava/derive-activities.test.ts
import { describe, it, expect } from 'vitest'
import { stravaActivitySportKey, isDerivableActivity } from '@/lib/strava/derive-activities'

describe('strava → activities classificatie', () => {
  it('mapt niet-run/walk Strava-types naar SportKey', () => {
    expect(stravaActivitySportKey({ activity_type: 'Ride', sport_type: 'MountainBikeRide' })).toBe('cycle')
    expect(stravaActivitySportKey({ activity_type: 'Workout', sport_type: 'Workout' })).toBe('other')
    expect(stravaActivitySportKey({ activity_type: 'Soccer', sport_type: 'Soccer' })).toBe('football')
  })
  it('sluit run/walk/hike uit (die gaan naar runs/walks)', () => {
    expect(isDerivableActivity({ activity_type: 'Run' })).toBe(false)
    expect(isDerivableActivity({ activity_type: 'Walk' })).toBe(false)
    expect(isDerivableActivity({ activity_type: 'Hike' })).toBe(false)
    expect(isDerivableActivity({ activity_type: 'Ride' })).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/strava/derive-activities.test.ts`
Expected: FAIL — module niet gevonden.

- [ ] **Step 3: Implement.**

```ts
// src/lib/strava/derive-activities.ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { classifySport } from '@/lib/sports/classify'
import type { SportKey } from '@/lib/sports/registry'

type AdminClient = SupabaseClient<Database>
const RUN_WALK = ['run', 'trailrun', 'virtualrun', 'walk', 'hike']

export function isDerivableActivity(a: { activity_type?: string | null; sport_type?: string | null }): boolean {
  const t = (a.sport_type ?? a.activity_type ?? '').toLowerCase()
  return !RUN_WALK.some((x) => t.includes(x))
}
export function stravaActivitySportKey(a: { activity_type?: string | null; sport_type?: string | null }): SportKey {
  return classifySport(a.sport_type ?? a.activity_type ?? '', 'strava')
}

interface DeriveResult { scanned: number; inserted: number; matched: number }

export async function deriveActivitiesFromStrava(userId: string, admin: AdminClient): Promise<DeriveResult> {
  const { data, error } = await admin
    .from('strava_activities')
    .select('strava_activity_id, name, activity_type, sport_type, start_date, distance_meters, moving_time_seconds, elapsed_time_seconds, total_elevation_gain_meters, average_heartrate, max_heartrate, calories')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })
  if (error) throw new Error(`Failed to load strava_activities: ${error.message}`)

  const derivable = (data ?? []).filter(isDerivableActivity)
  let inserted = 0, matched = 0
  for (const sa of derivable) {
    const duration = sa.moving_time_seconds ?? sa.elapsed_time_seconds ?? null
    const { data: existing } = await admin.from('activities')
      .select('id').eq('user_id', userId).eq('strava_activity_id', sa.strava_activity_id).maybeSingle()
    const row = {
      user_id: userId,
      sport_key: stravaActivitySportKey(sa),
      source: 'strava' as const,
      strava_activity_id: sa.strava_activity_id,
      apple_health_id: null,
      name: sa.name,
      started_at: sa.start_date,
      ended_at: duration ? new Date(new Date(sa.start_date).getTime() + duration * 1000).toISOString() : null,
      duration_seconds: duration,
      distance_meters: sa.distance_meters,
      calories_burned: sa.calories,
      avg_heart_rate: sa.average_heartrate != null ? Math.round(sa.average_heartrate) : null,
      max_heart_rate: sa.max_heartrate != null ? Math.round(sa.max_heartrate) : null,
      elevation_gain_meters: sa.total_elevation_gain_meters,
      intensity: null,
    }
    if (existing) {
      await admin.from('activities').update(row).eq('id', existing.id); matched += 1
    } else {
      const { error: insErr } = await admin.from('activities').insert(row)
      if (insErr) { console.error('[derive-activities] insert failed', insErr); continue }
      inserted += 1
    }
  }
  return { scanned: derivable.length, inserted, matched }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/strava/derive-activities.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire in `sync.ts`.**

In `src/lib/strava/sync.ts`: importeer `deriveActivitiesFromStrava`, en roep het aan na `deriveWalksFromStrava` in dezelfde try/catch-stijl (`let derivedActivities = null; try { derivedActivities = await deriveActivitiesFromStrava(userId, admin) } catch (e) { console.error(...) }`). Voeg `derivedActivities` toe aan `StravaSyncResult` en de return.

- [ ] **Step 6: Verify + commit.**

Run: `pnpm test`, `pnpm build`.

```bash
git add src/lib/strava/derive-activities.ts tests/lib/strava/derive-activities.test.ts src/lib/strava/sync.ts
git commit -m "feat(strava): derive non-run/walk activiteiten naar activities"
```

---

## FASE 3b — Weekstrip toont alle sporten

### Task 11: `/api/schema/week` + token-type verbreden

**Files:**
- Modify: `src/app/api/schema/week/route.ts`
- Modify: `src/hooks/useSchemaWeek.ts`

- [ ] **Step 1: Verbreed het token-type + classificatie.**

In zowel `src/app/api/schema/week/route.ts` als `src/hooks/useSchemaWeek.ts`: vervang `export type ActivityType = 'gym' | 'run' | 'padel'` door `import { type SportKey } ...; export type ActivityType = SportKey`. Vervang `classifyByTitle` door `classifySport(title, 'manual')` (registry).

- [ ] **Step 2: Voeg `walks` + `activities` toe aan de week-query.**

In `route.ts`, breid de `Promise.all` (regels ~257-277) uit met `walks` en `activities` voor het week-venster. Groepeer per Amsterdam-datum (zoals `runsByDate`), en voeg per dag `done-extra` tokens toe voor walk-rijen (`type:'walk'`) en activities-rijen (`type: a.sport_key`). Spiegel het bestaande run-token-blok (regels ~397-421); deze hebben geen plan-match dus altijd `state:'done-extra'` (tenzij je later plan-matching toevoegt).

```ts
// week-query toevoegen:
admin.from('walks').select('id, started_at, duration_seconds, distance_meters')
  .eq('user_id', user.id).gte('started_at', `${weekStart}T00:00:00Z`).lte('started_at', `${weekEnd}T23:59:59Z`),
admin.from('activities').select('id, sport_key, name, started_at, duration_seconds')
  .eq('user_id', user.id).gte('started_at', `${weekStart}T00:00:00Z`).lte('started_at', `${weekEnd}T23:59:59Z`),
// per dag, na de padel-loop:
for (const w of (walksByDate.get(date) ?? [])) {
  tokens.push({ type: 'walk', state: 'done-extra', title: 'Wandeling', actualId: w.id, actualStartedAt: w.started_at, actualDurationSeconds: w.duration_seconds })
}
for (const a of (activitiesByDate.get(date) ?? [])) {
  tokens.push({ type: a.sport_key as ActivityType, state: 'done-extra', title: a.name ?? a.sport_key, actualId: a.id, actualStartedAt: a.started_at, actualDurationSeconds: a.duration_seconds })
}
```

- [ ] **Step 3: Verify — weekstrip toont nu wandeling/tennis/HIIT-pills.**

Run: `pnpm test`, `pnpm build`. Open home "DEZE WEEK": een wandeling of tennismatch verschijnt als gekleurde pill op de juiste dag. `tokenHref` mag `null` blijven voor deze types (geen detailpagina) — `WeekGlance` rendert ze dan als niet-klikbare pill (al ondersteund).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/schema/week/route.ts src/hooks/useSchemaWeek.ts
git commit -m "feat(home): weekstrip toont walks + alle generieke sporten"
```

> **Checkpoint fase 3b (volledige multi-sport win):** Elke sport — Apple én Strava — is zichtbaar in feed én weekstrip. `pnpm test` + `pnpm build` groen.

---

## Self-review notities

- **Spec-dekking:** Fase 0 (registry) = Task 1-5. Fase 1 (tabel+Apple) = Task 6-8. Fase 2 (Strava) = Task 10. Fase 3 (feed+weekstrip) = Task 9 + Task 11. Fase 4 (rust-HR) + fase 5 (verborgen data) = **eigen vervolgplannen** (bewust buiten scope).
- **Typeconsistentie:** `SportKey` is overal de canonieke union; `ActivityType` in `/api/activities` en `/api/schema/week` aliassen ernaar. `ParsedActivity.sportKey`, DB-kolom `sport_key`, registry-key komen overeen.
- **Volgorde-afhankelijkheid:** Task 7-8 hebben de migratie (Task 6) + types nodig. Task 9/11 hebben de registry (fase 0) + tabel nodig. Task 10 onafhankelijk van 9/11 (kan parallel).
- **Open punt (cross-source dedup Apple↔Strava):** een sessie die zowel via Apple als Strava binnenkomt verschijnt mogelijk dubbel in `activities`. Bewust uitgesteld (spec §7); aanpakken als het in de praktijk speelt, met een tijdvenster-match zoals runs/walks.
