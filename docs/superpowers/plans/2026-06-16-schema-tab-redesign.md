# Schema-tab herontwerp — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De Schema-tab van 6 overlappende kaarten naar header + 2 kaarten brengen, met één klikbare week-kiezer, een tijdgebonden/wegklikbare "Net gestart"-strook, en een gedeelde plan-vs-werkelijkheid-matcher die afwijken-van-planning correct afhandelt en Home + Schema gelijk laat lopen.

**Architecture:** Eerst een pure, geteste matcher `src/lib/training/reconcile-week.ts` (canonicalisatie + per-dag matching + cross-day rescue op gelijke titel). Daarna `/api/schema` erop laten draaien (lost de bug op), dan de UI herstructureren, en als laatste, afgeschermde fase `/api/schema/week` erop migreren (vorm-behoudend, 13 consumers).

**Tech Stack:** Next.js App Router (route handlers), TypeScript (strict), Vitest (happy-dom), Tailwind v2-tokens, Supabase (admin client), SWR.

**Spec:** `docs/superpowers/specs/2026-06-16-schema-tab-redesign-design.md`

---

## Bestandsoverzicht

| Bestand | Verantwoordelijkheid | Fase |
|---------|----------------------|------|
| `src/lib/training/reconcile-week.ts` (nieuw) | Pure matcher: `canon`, `titlesMatch`, `reconcileWeek` | 1 |
| `tests/lib/training/reconcile-week.test.ts` (nieuw) | Unit tests voor de matcher | 1 |
| `src/app/api/schema/route.ts` (wijzig) | Gebruik `reconcileWeek`; voeg `created_at` toe | 2 |
| `src/hooks/useSchema.ts` (wijzig) | Voeg `createdAt` toe aan `SchemaData` | 2 |
| `src/components/schema/v2/SchemaBlockHeader.tsx` (wijzig) | Eén balk = blok-positie | 3 |
| `src/components/schema/v2/SchemaStartedBanner.tsx` (nieuw) | Tijdgebonden + wegklikbare "Net gestart" | 3 |
| `src/components/schema/SchemaCalendar.tsx` (wijzig) | Klikbare week-kiezer i.p.v. chevrons + dots | 3 |
| `src/components/schema/SchemaProgress.tsx` (verwijder) | Opgegaan in week-kiezer | 3 |
| `src/components/schema/SchemaOverview.tsx` (wijzig) | Styling-unificatie, ingeklapt | 3 |
| `src/components/schema/SchemaPageContent.tsx` (wijzig) | Herindeling header + 2 kaarten + nudge + banner | 3 |
| `src/app/api/schema/week/route.ts` (wijzig) | Gebruik `reconcileWeek`, vorm-behoudend | 4 |
| `tests/lib/training/schema-week-characterisation.test.ts` (nieuw) | Borgt ongewijzigd gedrag week-endpoint | 4 |

---

## Fase 1 — Gedeelde matcher (TDD)

De kern. Pure functies, geen I/O. Volledig getest vóór er een endpoint op draait.

### Task 1: `reconcile-week.ts` — types, `canon`, `titlesMatch`, `reconcileWeek`

**Files:**
- Create: `src/lib/training/reconcile-week.ts`
- Test: `tests/lib/training/reconcile-week.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/training/reconcile-week.test.ts
import { describe, test, expect } from 'vitest'
import {
  canon,
  titlesMatch,
  reconcileWeek,
  type PlannedSession,
  type CompletionInput,
} from '@/lib/training/reconcile-week'

// Week van ma 2026-06-15 .. zo 2026-06-21; "vandaag" = di 2026-06-16.
const MON = '2026-06-15'
const TUE = '2026-06-16'
const WED = '2026-06-17'
const THU = '2026-06-18'
const TODAY = TUE
const opts = { today: TODAY }

function gymPlan(date: string, focus: string): PlannedSession {
  return { plannedDate: date, focus, kind: 'gym' }
}
function gymDone(date: string, title: string, id = `c-${date}`): CompletionInput {
  return { date, kind: 'gym', title, id }
}

describe('canon', () => {
  test('strips spaced descriptor suffix', () => {
    expect(canon('Lower B — Hinge Dominant')).toBe('lower b')
    expect(canon('Upper A - Heavy')).toBe('upper a')
  })
  test('lowercases, trims, collapses whitespace, strips diacritics', () => {
    expect(canon('  Upper   A ')).toBe('upper a')
    expect(canon('Café Press')).toBe('cafe press')
  })
  test('keeps hyphenated words without surrounding spaces', () => {
    expect(canon('T-Bar Row')).toBe('t-bar row')
    expect(canon('Push-Pull')).toBe('push-pull')
  })
})

describe('titlesMatch', () => {
  test('matches across descriptor suffix and case', () => {
    expect(titlesMatch('Lower B — Hinge Dominant', 'Lower B')).toBe(true)
    expect(titlesMatch('upper a', 'Upper A')).toBe(true)
  })
  test('rejects genuinely different titles', () => {
    expect(titlesMatch('Upper A', 'Upper B')).toBe(false)
  })
})

describe('reconcileWeek — same day', () => {
  test('done-as-planned when title matches', () => {
    const items = reconcileWeek([gymPlan(MON, 'Upper A')], [gymDone(MON, 'Upper A')], opts)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ state: 'done-as-planned', displayDate: MON })
    expect(items[0].movedFromDate).toBeUndefined()
  })
  test('done-swap when a different gym is done that day', () => {
    const items = reconcileWeek([gymPlan(MON, 'Upper A')], [gymDone(MON, 'Leg Day')], opts)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ state: 'done-swap', swappedFrom: 'Upper A', title: 'Leg Day' })
  })
  test('cross-sport swap (planned gym, did run)', () => {
    const items = reconcileWeek(
      [gymPlan(MON, 'Upper A')],
      [{ date: MON, kind: 'run', title: 'Hardlopen', id: 'r1' }],
      opts,
    )
    expect(items[0]).toMatchObject({ state: 'done-swap', kind: 'run', swappedFrom: 'Upper A' })
  })
})

describe('reconcileWeek — cross-day rescue (the bug)', () => {
  test('same canonical title on another day fulfils the plan and moves it', () => {
    const items = reconcileWeek([gymPlan(MON, 'Upper A')], [gymDone(TUE, 'Upper A')], opts)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      state: 'done-as-planned',
      displayDate: TUE,
      movedFromDate: MON,
      plannedDate: MON,
      actualDate: TUE,
    })
  })
  test('canonicalisation bridges a descriptor-suffix title', () => {
    const items = reconcileWeek([gymPlan(MON, 'Upper A')], [gymDone(TUE, 'Upper A — Push Focus')], opts)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ state: 'done-as-planned', displayDate: TUE, movedFromDate: MON })
  })
  test('no rescue when the other-day gym is genuinely different', () => {
    const items = reconcileWeek([gymPlan(MON, 'Upper A')], [gymDone(TUE, 'Leg Day')], opts)
    const missed = items.find((i) => i.state === 'missed')
    const extra = items.find((i) => i.state === 'done-extra')
    expect(missed).toMatchObject({ displayDate: MON, title: 'Upper A' })
    expect(extra).toMatchObject({ displayDate: TUE, title: 'Leg Day' })
  })
})

describe('reconcileWeek — unmatched planned & extras', () => {
  test('past unmatched plan = missed', () => {
    const items = reconcileWeek([gymPlan(MON, 'Upper A')], [], opts)
    expect(items[0]).toMatchObject({ state: 'missed', displayDate: MON })
  })
  test('today unmatched plan = planned-today', () => {
    const items = reconcileWeek([gymPlan(TUE, 'Upper A')], [], opts)
    expect(items[0]).toMatchObject({ state: 'planned-today', displayDate: TUE })
  })
  test('future unmatched plan = planned', () => {
    const items = reconcileWeek([gymPlan(THU, 'Upper A')], [], opts)
    expect(items[0]).toMatchObject({ state: 'planned', displayDate: THU })
  })
  test('unplanned completion = done-extra', () => {
    const items = reconcileWeek([], [gymDone(WED, 'Random Pump')], opts)
    expect(items[0]).toMatchObject({ state: 'done-extra', displayDate: WED, title: 'Random Pump' })
  })
  test('run done as planned', () => {
    const items = reconcileWeek(
      [{ plannedDate: WED, focus: 'Hardlopen', kind: 'run' }],
      [{ date: WED, kind: 'run', title: 'Hardlopen', id: 'r2' }],
      opts,
    )
    expect(items[0]).toMatchObject({ state: 'done-as-planned', kind: 'run', displayDate: WED })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/training/reconcile-week.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/training/reconcile-week"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/training/reconcile-week.ts

/** Sport-categorie van een sessie. */
export type ActivityKind = 'gym' | 'run' | 'padel'

export type ReconciledState =
  | 'done-as-planned'
  | 'done-swap'
  | 'done-extra'
  | 'planned'
  | 'planned-today'
  | 'missed'

export interface PlannedExerciseInput {
  name: string
  sets?: number
  reps?: string
  rest_seconds?: number
  rpe?: string
  tempo?: string
  notes?: string
}

export interface PlannedSession {
  plannedDate: string // YYYY-MM-DD (Amsterdam)
  focus: string
  kind: ActivityKind
  exercises?: PlannedExerciseInput[]
  subtitle?: string
  durationMin?: number
}

export interface CompletionInput {
  date: string // YYYY-MM-DD (Amsterdam)
  kind: ActivityKind
  title: string
  id?: string
  durationSeconds?: number | null
  startedAt?: string
  distanceMeters?: number
  /** Opake passthrough (bv. geëxtraheerde oefeningen) — de lib raakt dit niet aan. */
  exercises?: unknown
}

export interface ReconciledItem {
  kind: ActivityKind
  state: ReconciledState
  /** Dag waarop het item getoond wordt (actual bij done-*, anders gepland). */
  displayDate: string
  /** Toon-titel: actual bij done-*, geplande focus anders. */
  title: string
  plannedDate?: string
  plannedFocus?: string
  actualDate?: string
  /** Gezet als plannedDate !== actualDate (cross-day verplaatst); UI toont "↩ <dag>". */
  movedFromDate?: string
  /** done-swap: de oorspronkelijk geplande focus. */
  swappedFrom?: string
  completionId?: string
  durationSeconds?: number | null
  startedAt?: string
  distanceMeters?: number
  plannedExercises?: PlannedExerciseInput[]
  actualExercises?: unknown
  subtitle?: string
  durationMin?: number
}

export interface ReconcileOptions {
  today: string // YYYY-MM-DD (Amsterdam)
}

/** Canonicaliseer een titel voor gelijkheids-matching. */
export function canon(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s*[—–-]\s+.*$/u, '') // beschrijvende staart met spatie eromheen
    .replace(/\s+/g, ' ')
    .trim()
}

export function titlesMatch(a: string, b: string): boolean {
  return canon(a) === canon(b)
}

const KIND_ORDER: ActivityKind[] = ['gym', 'run', 'padel']

function makeDoneItem(
  slot: PlannedSession,
  c: CompletionInput,
  state: 'done-as-planned' | 'done-swap',
  displayDate: string,
  movedFromDate?: string,
): ReconciledItem {
  return {
    kind: c.kind,
    state,
    displayDate,
    title: c.title,
    plannedDate: slot.plannedDate,
    plannedFocus: slot.focus,
    actualDate: c.date,
    movedFromDate,
    swappedFrom: state === 'done-swap' ? slot.focus : undefined,
    completionId: c.id,
    durationSeconds: c.durationSeconds,
    startedAt: c.startedAt,
    distanceMeters: c.distanceMeters,
    plannedExercises: slot.exercises,
    actualExercises: c.exercises,
    subtitle: slot.subtitle,
    durationMin: slot.durationMin,
  }
}

/**
 * Koppel geplande sessies aan daadwerkelijk gelogde sessies binnen één week.
 * Step A: per dag (zelfde-slot, sport-bewust). Step B: cross-day rescue voor
 * gym op gelijke gecanonicaliseerde titel. Daarna: resterende planned ->
 * planned/planned-today/missed, resterende completions -> done-extra.
 */
export function reconcileWeek(
  planned: PlannedSession[],
  completions: CompletionInput[],
  opts: ReconcileOptions,
): ReconciledItem[] {
  const { today } = opts
  const comps = completions.map((c) => ({ ...c, used: false }))
  const slots = planned.map((p) => ({ ...p, fulfilled: false }))
  const items: ReconciledItem[] = []

  const dates = Array.from(
    new Set<string>([...slots.map((s) => s.plannedDate), ...comps.map((c) => c.date)]),
  ).sort()

  // ── Step A: per-dag, zelfde-slot ──
  for (const date of dates) {
    const dayComps = comps
      .filter((c) => c.date === date)
      .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
    const daySlots = slots.filter((s) => s.plannedDate === date)

    for (const c of dayComps) {
      if (c.used) continue
      const slot =
        daySlots.find((s) => !s.fulfilled && s.kind === c.kind && titlesMatch(s.focus, c.title)) ??
        daySlots.find((s) => !s.fulfilled && s.kind === c.kind) ??
        daySlots.find((s) => !s.fulfilled)
      if (slot) {
        slot.fulfilled = true
        c.used = true
        const asPlanned = slot.kind === c.kind && titlesMatch(slot.focus, c.title)
        items.push(makeDoneItem(slot, c, asPlanned ? 'done-as-planned' : 'done-swap', date))
      }
    }
  }

  // ── Step B: cross-day rescue (gym, gelijke titel) ──
  for (const slot of slots) {
    if (slot.fulfilled || slot.kind !== 'gym') continue
    const c = comps.find((x) => !x.used && x.kind === 'gym' && titlesMatch(slot.focus, x.title))
    if (c) {
      slot.fulfilled = true
      c.used = true
      items.push(makeDoneItem(slot, c, 'done-as-planned', c.date, slot.plannedDate))
    }
  }

  // ── Resterende planned ──
  for (const slot of slots) {
    if (slot.fulfilled) continue
    const state: ReconciledState =
      slot.plannedDate < today ? 'missed' : slot.plannedDate === today ? 'planned-today' : 'planned'
    items.push({
      kind: slot.kind,
      state,
      displayDate: slot.plannedDate,
      title: slot.focus,
      plannedDate: slot.plannedDate,
      plannedFocus: slot.focus,
      plannedExercises: slot.exercises,
      subtitle: slot.subtitle,
      durationMin: slot.durationMin,
    })
  }

  // ── Resterende completions = extra ──
  for (const c of comps) {
    if (c.used) continue
    items.push({
      kind: c.kind,
      state: 'done-extra',
      displayDate: c.date,
      title: c.title,
      actualDate: c.date,
      completionId: c.id,
      durationSeconds: c.durationSeconds,
      startedAt: c.startedAt,
      distanceMeters: c.distanceMeters,
      actualExercises: c.exercises,
    })
  }

  return items
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/training/reconcile-week.test.ts`
Expected: PASS — alle cases groen.

- [ ] **Step 5: Commit**

```bash
git add src/lib/training/reconcile-week.ts tests/lib/training/reconcile-week.test.ts
git commit -m "feat(schema): add shared week reconciliation matcher"
```

---

## Fase 2 — Schema-tab data-fix (`/api/schema`)

Laat de Schema-tab op `reconcileWeek` draaien. Lost punt 3 op. Vorm van de response
(`weeks[].days[].items`) blijft gelijk; alleen de matching verbetert.

### Task 2: Rewire `/api/schema` GET op `reconcileWeek` + `created_at`

**Files:**
- Modify: `src/app/api/schema/route.ts`

- [ ] **Step 1: Voeg `created_at` toe aan de select**

In de `.select(...)` op de `training_schemas`-query (rond regel 124-126), voeg `created_at` toe:

```ts
.select('id, title, description, schema_type, start_date, end_date, weeks_planned, current_week, workout_schedule, scheduled_overrides, progression_rules, quality_audit, planned_weekly_load, source_block_review_id, ai_generated, created_at, updated_at')
```

- [ ] **Step 2: Vervang de `enrichedWeeks`-matcher door `reconcileWeek`**

Vervang het hele blok `const enrichedWeeks = weeks.map((week) => { ... })` (de huidige 2-pass
matcher, regels ~212-354) door onderstaande implementatie. Importeer bovenaan het bestand:

```ts
import { reconcileWeek, type PlannedSession, type CompletionInput, type ActivityKind } from '@/lib/training/reconcile-week'
```

```ts
const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })

function focusKind(focus: string): ActivityKind {
  const f = focus.toLowerCase().trim()
  if (f.includes('hardlopen') || f.includes('run')) return 'run'
  if (f.includes('padel')) return 'padel'
  return 'gym'
}

const enrichedWeeks = weeks.map((week) => {
  const weekDates = new Set(week.days.map((d) => d.date))

  // Geplande sessies deze week (override > template is al verwerkt in week.days).
  const planned: PlannedSession[] = []
  for (const d of week.days) {
    if (!d.workoutFocus) continue
    const exercises = d.exercises ?? schedule.find((s) => s.day.toLowerCase() === d.dayName)?.exercises
    planned.push({ plannedDate: d.date, focus: d.workoutFocus, kind: focusKind(d.workoutFocus), exercises })
  }

  // Daadwerkelijk gelogde sessies binnen deze week.
  const completions: CompletionInput[] = []
  for (const [date, titles] of workoutsByDate) {
    if (!weekDates.has(date)) continue
    for (const t of titles) completions.push({ date, kind: 'gym', title: t })
  }
  for (const d of runDates) if (weekDates.has(d)) completions.push({ date: d, kind: 'run', title: 'Hardlopen' })
  for (const d of padelDates) if (weekDates.has(d)) completions.push({ date: d, kind: 'padel', title: 'Padel' })

  const reconciled = reconcileWeek(planned, completions, { today: todayStr })

  type DayItem = {
    focus: string
    exercises?: typeof planned[number]['exercises']
    status: 'completed' | 'today' | 'planned'
    plannedDate?: string
    actualDate?: string
    unplanned?: boolean
  }

  const itemsByDate = new Map<string, DayItem[]>()
  for (const r of reconciled) {
    if (r.state === 'missed') continue // verbergen, conform keuze Stef
    const status: DayItem['status'] = r.state.startsWith('done-')
      ? 'completed'
      : r.state === 'planned-today'
        ? 'today'
        : 'planned'
    const item: DayItem = {
      focus: r.state === 'done-extra' ? titleCase(r.title) : r.title,
      exercises: r.plannedExercises,
      status,
      plannedDate: r.plannedDate,
      actualDate: r.actualDate,
      unplanned: r.state === 'done-extra' || undefined,
    }
    const arr = itemsByDate.get(r.displayDate) ?? []
    arr.push(item)
    itemsByDate.set(r.displayDate, arr)
  }

  const enrichedDays = week.days.map((day) => {
    const items = itemsByDate.get(day.date) ?? []
    const primary = items[0]
    const dayStatus: 'completed' | 'today' | 'planned' | 'rest' = !primary
      ? 'rest'
      : items.every((i) => i.status === 'completed')
        ? 'completed'
        : day.date === todayStr
          ? 'today'
          : 'planned'
    return {
      date: day.date,
      dayName: day.dayName,
      workoutFocus: primary?.focus ?? null,
      exercises: primary?.exercises,
      status: dayStatus,
      items,
    }
  })

  const sessionsPlanned = planned.length
  const sessionsCompleted = reconciled.filter((r) => r.state.startsWith('done-') && r.plannedDate).length

  return {
    ...week,
    days: enrichedDays,
    sessionsPlanned,
    sessionsCompleted,
    isComplete: sessionsCompleted >= sessionsPlanned && sessionsPlanned > 0,
  }
})
```

Voeg onderaan het bestand de kleine helper toe (vervangt de oude inline `focusLabel`-casing):

```ts
function titleCase(s: string): string {
  return s.replace(/\b\w/g, (m) => m.toUpperCase())
}
```

- [ ] **Step 3: Geef `created_at` mee in de JSON-respons**

In het `return NextResponse.json({ ... })`-object (rond regel 361), voeg toe naast `updatedAt`:

```ts
createdAt: schema.created_at,
```

- [ ] **Step 4: Typecheck + bestaande tests groen**

Run: `pnpm tsc --noEmit && pnpm vitest run tests/lib/training/reconcile-week.test.ts`
Expected: geen type-errors; reconcile-tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/schema/route.ts
git commit -m "feat(schema): reconcile schema weeks via shared matcher + expose created_at"
```

### Task 3: `SchemaData.createdAt` in de hook

**Files:**
- Modify: `src/hooks/useSchema.ts`

- [ ] **Step 1: Voeg het veld toe aan de interface**

In `interface SchemaData` (na `updatedAt: string | null`):

```ts
  createdAt: string | null
```

- [ ] **Step 2: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: geen errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSchema.ts
git commit -m "feat(schema): surface createdAt in useSchema"
```

---

## Fase 3 — UI-herontwerp

### Task 4: `SchemaBlockHeader` — één balk = blok-positie

**Files:**
- Modify: `src/components/schema/v2/SchemaBlockHeader.tsx`

- [ ] **Step 1: Vervang de progress-sectie**

De huidige balk gebruikt `progress = (weekOfBlock - 1) / totalWeeks` en toont eronder
`sessionsCompleted / sessionsPlanned`. Houd de balk (blok-positie) maar verwijder de
sessie-teller-regel uit de kop (die staat straks in de weekkaart). Vervang het blok vanaf
`{/* Progress bar */}` tot het einde van de component door:

```tsx
      {/* Progress bar — blok-positie (week van blok) */}
      <div className="mt-3.5 h-[6px] rounded-full overflow-hidden bg-white/[0.06]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(progress * 100, 100)}%`,
            background: 'linear-gradient(90deg, #00E5C7, #7C3AED)',
          }}
        />
      </div>
      {daysLeft > 0 && (
        <div className="mt-1.5 text-[11px] text-text-tertiary">{daysLeft} dagen te gaan</div>
      )}
    </div>
  )
}
```

`sessionsCompleted`/`sessionsPlanned` blijven props (achterwaarts compatibel) maar worden niet
meer in de kop gerenderd.

- [ ] **Step 2: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: geen errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/schema/v2/SchemaBlockHeader.tsx
git commit -m "refactor(schema): header shows one block-position bar only"
```

### Task 5: `SchemaStartedBanner` — tijdgebonden + wegklikbaar

**Files:**
- Create: `src/components/schema/v2/SchemaStartedBanner.tsx`

- [ ] **Step 1: Maak de component**

```tsx
'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

const WINDOW_MS = 72 * 60 * 60 * 1000

interface SchemaStartedBannerProps {
  schemaId: string
  createdAt: string | null
  sourceBlockReviewId: string | null | undefined
  onUndo: () => Promise<void>
}

/** Toon alleen binnen 72u na aanmaken, met source-block-review, en niet weggeklikt. */
export function SchemaStartedBanner({
  schemaId,
  createdAt,
  sourceBlockReviewId,
  onUndo,
}: SchemaStartedBannerProps) {
  const storageKey = `schema-net-gestart-dismissed:${schemaId}`
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(storageKey) === '1'
  })
  const [undoing, setUndoing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const withinWindow =
    !!createdAt && Date.now() - new Date(createdAt).getTime() < WINDOW_MS

  if (dismissed || !sourceBlockReviewId || !withinWindow) return null

  function handleDismiss() {
    window.localStorage.setItem(storageKey, '1')
    setDismissed(true)
  }

  async function handleUndo() {
    setUndoing(true)
    setError(null)
    try {
      await onUndo()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUndoing(false)
    }
  }

  return (
    <div className="rounded-[22px] border-[0.5px] border-status-warning/40 bg-status-warning/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[13px] font-medium text-text-primary">Net gestart</div>
          <div className="text-[12px] text-text-secondary">Niet wat je bedoelde?</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoing}
            className="rounded-full border border-status-warning/60 px-3 py-1.5 text-[12px] text-status-warning disabled:opacity-40"
          >
            {undoing ? 'Bezig...' : 'Ongedaan maken'}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Wegklikken"
            className="rounded-full p-1.5 text-text-tertiary hover:bg-white/[0.06]"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {error && <div className="mt-2 text-[12px] text-status-danger">{error}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: geen errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/schema/v2/SchemaStartedBanner.tsx
git commit -m "feat(schema): time-boxed, dismissible 'Net gestart' banner"
```

### Task 6: Klikbare week-kiezer in `SchemaCalendar` (chevrons + dots eruit)

**Files:**
- Modify: `src/components/schema/SchemaCalendar.tsx`

- [ ] **Step 1: Voeg de week-kiezer-strip toe boven de week-header**

Direct binnen de buitenste `<div className="rounded-[22px] ...">` (vóór de bestaande
"Week selector header"), voeg de klikbare W-blokjes toe (vervangt de functie van de oude
`SchemaProgress`-segmenten):

```tsx
      {/* Week-kiezer — klikbare blokjes met per-week fill */}
      <div className="flex gap-1 px-4 pt-3">
        {weeks.map((w) => {
          const isSel = w.weekNumber === selectedWeek
          const fill = w.sessionsPlanned > 0
            ? Math.round((w.sessionsCompleted / w.sessionsPlanned) * 100)
            : 0
          return (
            <button
              key={w.weekNumber}
              onClick={() => setSelectedWeek(w.weekNumber)}
              className="flex-1 flex flex-col gap-1"
              aria-label={`Week ${w.weekNumber}`}
              aria-current={isSel ? 'true' : undefined}
            >
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: isSel ? 'rgba(0,229,199,0.18)' : 'rgba(255,255,255,0.06)' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${fill}%`,
                    background: isSel ? '#00E5C7' : fill === 100 ? 'rgba(0,229,199,0.60)' : 'rgba(0,229,199,0.30)',
                  }}
                />
              </div>
              <span
                className="text-[10px] text-center tabular-nums"
                style={{
                  fontWeight: isSel ? 600 : 400,
                  color: isSel ? 'var(--color-sport-gym-base)' : 'var(--color-text-tertiary)',
                }}
              >
                W{w.weekNumber}
              </span>
            </button>
          )
        })}
      </div>
```

- [ ] **Step 2: Vervang de chevron-koppen door een statische week-titel**

In de "Week selector header" (`<div className="flex items-center justify-between px-4 py-3 border-b border-bg-border">`), verwijder de twee chevron-knoppen (`ChevronLeft`/`ChevronRight`) en laat het midden-blok staan; maak het een gecentreerde kop:

```tsx
      {/* Week-header (navigatie zit in de week-kiezer hierboven) */}
      <div className="px-4 py-3 border-b border-bg-border text-center">
        <h3 className="text-[14px] font-semibold text-text-primary">
          Week {selectedWeek}
          {selectedWeek === currentWeek && (
            <span className="ml-1.5 text-[10px] font-normal text-[var(--color-sport-gym-base)]">(huidige)</span>
          )}
        </h3>
        <p className="text-[11px] text-text-tertiary mt-0.5">
          {formatDateRange(week.days)} · {week.sessionsCompleted}/{week.sessionsPlanned} sessies
        </p>
        <button
          onClick={() => setEditingWeek(true)}
          className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-medium text-text-secondary hover:bg-white/[0.08]"
        >
          <Pencil size={10} />
          Aanpassen
        </button>
      </div>
```

- [ ] **Step 3: Verwijder de week-dots-navigatie**

Verwijder het hele blok `{/* Week dots navigation */}` (`<div className="flex items-center justify-center gap-1.5 py-3 border-t border-bg-border">...</div>`). De week-kiezer bovenin vervangt het.

- [ ] **Step 4: Ruim ongebruikte imports op**

Verwijder `ChevronLeft, ChevronRight` uit de `lucide-react`-import (regel 4).

- [ ] **Step 5: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: geen errors, geen ongebruikte imports.

- [ ] **Step 6: Commit**

```bash
git add src/components/schema/SchemaCalendar.tsx
git commit -m "feat(schema): single clickable week-picker, drop chevrons + dots"
```

### Task 7: Verwijder `SchemaProgress` en herindeel `SchemaPageContent`

**Files:**
- Delete: `src/components/schema/SchemaProgress.tsx`
- Modify: `src/components/schema/SchemaPageContent.tsx`

- [ ] **Step 1: Verwijder het bestand**

```bash
git rm src/components/schema/SchemaProgress.tsx
```

- [ ] **Step 2: Werk imports in `SchemaPageContent` bij**

Vervang de import-regels voor `SchemaProgress` en de v2-imports:

```tsx
import { SchemaBlockHeader, SchemaCoachNudge, SchemaStartedBanner } from './v2'
```

Verwijder `import { SchemaProgress } from './SchemaProgress'`.

- [ ] **Step 3: Vervang de render-body**

Vervang het `return ( ... )`-blok (vanaf `<div className="flex flex-col pb-24">`) door:

```tsx
  return (
    <div className="flex flex-col pb-24">
      <SchemaBlockHeader
        title={data.title}
        weekLabel={weekLabel}
        weekOfBlock={data.currentWeek}
        totalWeeks={data.totalWeeks}
        sessionsCompleted={data.totalSessionsCompleted}
        sessionsPlanned={data.totalSessionsPlanned}
      />

      <div className="flex flex-col gap-3 px-4">
        <SchemaStartedBanner
          schemaId={data.id}
          createdAt={data.createdAt}
          sourceBlockReviewId={data.sourceBlockReviewId}
          onUndo={handleUndoBlockReview}
        />

        <SchemaCalendar
          weeks={data.weeks}
          currentWeek={data.currentWeek}
          calendarConnected={calendarConnected}
          templateSchedule={data.schedule}
          onReschedule={handleReschedule}
          onPushToCalendar={() => setCalendarModalOpen(true)}
          onSchemaChanged={() => {
            mutate()
            refreshSchemaWeek()
          }}
        />

        <SchemaOverview
          title={data.title}
          schemaType={data.schemaType}
          schedule={data.schedule}
          onSave={handleSaveSchedule}
        />

        <SchemaCoachNudge
          message={isLastWeek ? 'Blok klaar — start Block Review' : nudgeMessage}
          href={isLastWeek ? '/block-review' : undefined}
        />
      </div>

      {calendarModalOpen && <PlanWeekModal onClose={() => setCalendarModalOpen(false)} />}
    </div>
  )
```

Let op: `handleUndoBlockReview` blijft bestaan (wordt nu via de banner aangeroepen).
`undoError`/`undoing`/`setUndoError`/`setUndoing` state mag verwijderd worden uit
`SchemaPageContent` (de banner beheert dit nu intern) — verwijder die `useState`-regels en de
`setUndoing/setUndoError`-aanroepen in `handleUndoBlockReview`, zodat de functie puur is:

```tsx
  async function handleUndoBlockReview() {
    const res = await fetch('/api/block-review/undo', { method: 'POST' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? 'Terugdraaien mislukt')
    }
    await mutate()
    refreshSchemaWeek()
  }
```

- [ ] **Step 4: Exporteer de banner vanuit de v2-index**

Controleer `src/components/schema/v2/index.ts` (of `.tsx`) en voeg toe:

```ts
export { SchemaStartedBanner } from './SchemaStartedBanner'
```

- [ ] **Step 5: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: geen errors; geen verwijzingen meer naar `SchemaProgress`.

- [ ] **Step 6: Commit**

```bash
git add -A src/components/schema
git commit -m "feat(schema): drop SchemaProgress, reflow page to header + 2 cards + banner"
```

### Task 8: Styling-unificatie `SchemaOverview`

**Files:**
- Modify: `src/components/schema/SchemaOverview.tsx`

- [ ] **Step 1: Lijn de kaart-tokens uit**

Vervang de buitenste container-classes `rounded-2xl border border-bg-border bg-bg-surface
overflow-hidden` door de v2-kaartstijl:

```tsx
    <div className="rounded-[22px] border-[0.5px] border-bg-border bg-bg-surface overflow-hidden">
```

(De component is al standaard ingeklapt via `useState(false)` — geen verdere wijziging nodig.)

- [ ] **Step 2: Typecheck + visuele check**

Run: `pnpm tsc --noEmit`
Expected: geen errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/schema/SchemaOverview.tsx
git commit -m "style(schema): unify card tokens on SchemaOverview"
```

### Task 9: Handmatige UI-verificatie

- [ ] **Step 1: Start de dev-server en doorloop de tab**

Run: `pnpm dev` en open `/schema`.
Controleer:
- Header toont één balk (blok-positie) + "X dagen te gaan", geen dubbele sessie-teller.
- Week-kiezer W1..Wn is klikbaar; tikken wisselt het grid; geen chevrons/dots meer.
- "Net gestart" verschijnt alleen bij een vers blok (<72u) en is wegklikbaar; na wegklikken
  blijft hij weg (refresh).
- "Mijn Schema" is ingeklapt en heeft dezelfde kaartstijl als de rest.
- Een op een andere dag gelogde sessie met gelijke (gecanonicaliseerde) titel verschijnt op de
  dag dat je 'm deed, met "↩ <dag>", en is weg van de geplande dag.

Geen commit (handmatige stap).

---

## Fase 4 — Home/Schema consistentie (`/api/schema/week`)

Afgeschermd: dit endpoint voedt 13 componenten. De response-vorm (`tokens` + compat-velden)
MOET identiek blijven; alleen de matching wordt de gedeelde `reconcileWeek` (canonicalisatie +
cross-day rescue).

### Task 10: Characterisation-test voor het week-endpoint (vóór de refactor)

**Files:**
- Create: `tests/lib/training/schema-week-characterisation.test.ts`

- [ ] **Step 1: Schrijf een test die de huidige token-afleiding vastlegt**

Extraheer eerst de pure dag-afleiding niet — test in plaats daarvan `reconcileWeek` →
token-mapping als losse helper. Maak in deze stap een test die de **gewenste** token-output
beschrijft voor de niet-afwijkende gevallen (zodat de refactor die niet breekt) plus de nieuwe
cross-day-case:

```ts
import { describe, test, expect } from 'vitest'
import { reconcileWeek } from '@/lib/training/reconcile-week'
import { toTokens } from '@/app/api/schema/week/to-tokens'

const MON = '2026-06-15'
const TUE = '2026-06-16'
const opts = { today: TUE }

describe('week tokens', () => {
  test('done-as-planned same day keeps shape', () => {
    const tokens = toTokens(
      reconcileWeek([{ plannedDate: MON, focus: 'Upper A', kind: 'gym' }], [{ date: MON, kind: 'gym', title: 'Upper A', id: 'w1' }], opts),
      MON,
    )
    expect(tokens[0]).toMatchObject({ type: 'gym', state: 'done-as-planned', title: 'Upper A', actualId: 'w1' })
  })
  test('missed past is omitted from tokens', () => {
    const tokens = toTokens(reconcileWeek([{ plannedDate: MON, focus: 'Upper A', kind: 'gym' }], [], opts), MON)
    expect(tokens).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run — verwacht falen op ontbrekende `to-tokens`**

Run: `pnpm vitest run tests/lib/training/schema-week-characterisation.test.ts`
Expected: FAIL — `Failed to resolve import ".../to-tokens"`.

### Task 11: Extraheer `toTokens` en rewire het week-endpoint

**Files:**
- Create: `src/app/api/schema/week/to-tokens.ts`
- Modify: `src/app/api/schema/week/route.ts`

- [ ] **Step 1: Maak `to-tokens.ts` — map `ReconciledItem` per dag naar `ActivityToken`**

```ts
import type { ReconciledItem } from '@/lib/training/reconcile-week'
import type { ActivityToken } from '@/hooks/useSchemaWeek'

/** Filtert op één displaydag en mapt naar de bestaande ActivityToken-vorm. */
export function toTokens(items: ReconciledItem[], date: string): ActivityToken[] {
  return items
    .filter((i) => i.displayDate === date && i.state !== 'missed')
    .map((i) => ({
      type: i.kind,
      state: i.state as Exclude<ReconciledItem['state'], 'missed'>,
      // Behoud huidige weergave: gym/padel tonen actual-titel; run done-as-planned toont de
      // geplande focus (zoals het oude endpoint deed), anders 'Hardlopen'.
      title:
        i.kind === 'run' && i.state === 'done-as-planned' && i.plannedFocus
          ? i.plannedFocus
          : i.title,
      swappedFrom: i.swappedFrom,
      actualId: i.completionId,
      actualDurationSeconds: i.durationSeconds,
      actualStartedAt: i.startedAt,
      distanceMeters: i.distanceMeters,
      exercises: i.actualExercises as ActivityToken['exercises'],
      subtitle: i.subtitle,
      durationMin: i.durationMin,
    }))
}
```

- [ ] **Step 2: Bouw in `route.ts` `planned` + `completions` en gebruik `reconcileWeek` + `toTokens`**

Importeer bovenaan:

```ts
import { reconcileWeek, type PlannedSession, type CompletionInput, type ActivityKind } from '@/lib/training/reconcile-week'
import { toTokens } from './to-tokens'
```

Voeg vóór de huidige `const days: DayEntry[] = weekDates.map(...)` deze verzamel-helper en
opbouw toe. Hij hergebruikt de bestaande `overrides`, `scheduleByDay`, `classifyByTitle`,
`gymByDate`, `runsByDate`, `padelByDate`, `extractExercises` en `schema.workout_schedule`:

```ts
// Hergebruik de bestaande planned-bepaling (override > template > rust) per dag.
function plannedForDate(date: string, dayName: string): PlannedSession | null {
  let planned: ScheduleDay | null = null
  if (date in overrides) {
    const overrideFocus = overrides[date]
    if (overrideFocus === null) return null // expliciete rust
    const templateEntry = Array.from(scheduleByDay.values()).find(
      (s) => s.title.toLowerCase() === overrideFocus.toLowerCase(),
    )
    planned = templateEntry ?? { title: overrideFocus, subtitle: '', type: 'gym', duration_min: 60 }
  } else {
    planned = scheduleByDay.get(dayName) ?? null
  }
  if (!planned) return null
  const raw = schema.workout_schedule as unknown
  const exercises = Array.isArray(raw)
    ? (raw as WorkoutSchedule).find((s) => s.day.toLowerCase() === dayName)?.exercises
    : undefined
  return {
    plannedDate: date,
    focus: planned.title,
    kind: classifyByTitle(planned.title) as ActivityKind,
    exercises,
    subtitle: planned.subtitle || undefined,
    durationMin: planned.duration_min,
  }
}

const plannedSessions: PlannedSession[] = weekDates
  .map(({ date, dayName }) => plannedForDate(date, dayName))
  .filter((p): p is PlannedSession => p !== null)

const completions: CompletionInput[] = []
for (const [date, gyms] of gymByDate) {
  for (const g of gyms) {
    completions.push({
      date,
      kind: 'gym',
      title: g.title,
      id: g.id,
      durationSeconds: g.duration_seconds,
      startedAt: g.started_at,
      exercises: extractExercises(g),
    })
  }
}
for (const [date, runs] of runsByDate) {
  for (const r of runs) {
    completions.push({
      date,
      kind: 'run',
      title: 'Hardlopen',
      id: r.id,
      durationSeconds: r.duration_seconds,
      startedAt: r.started_at,
      distanceMeters: r.distance_meters,
    })
  }
}
for (const [date, padels] of padelByDate) {
  for (const p of padels) {
    completions.push({
      date,
      kind: 'padel',
      title: 'Padel',
      id: p.id,
      durationSeconds: p.duration_seconds,
      startedAt: p.started_at,
    })
  }
}

const reconciled = reconcileWeek(plannedSessions, completions, { today: todayStr })

// Titels van nog-niet-gedane gym-plannen verzamelen voor de lastPerformance-lookup.
const plannedTitles = new Set<string>()
for (const r of reconciled) {
  if ((r.state === 'planned' || r.state === 'planned-today') && r.kind === 'gym' && r.plannedFocus) {
    plannedTitles.add(r.plannedFocus)
  }
}
```

Vervang vervolgens de body van `const days: DayEntry[] = weekDates.map(...)` (de drie
actual-loops, het planned-token-blok en de compat-afleiding) door deze versie die per dag
`toTokens` gebruikt:

```ts
const days: DayEntry[] = weekDates.map(({ date, dayName, dayLabel }) => {
  const isToday = date === todayStr
  const tokens = toTokens(reconciled, date)

  const firstDone = tokens.find((t) => t.state.startsWith('done-'))
  const status: DayEntry['status'] = firstDone
    ? 'completed'
    : tokens.some((t) => t.state === 'planned-today')
      ? 'today'
      : tokens.some((t) => t.state === 'planned')
        ? 'planned'
        : 'rest'

  const plannedItem = reconciled.find(
    (r) => r.displayDate === date && (r.state === 'planned' || r.state === 'planned-today'),
  )
  let legacyWorkout: ScheduleDay | null = null
  if (plannedItem) {
    legacyWorkout = {
      title: plannedItem.title,
      subtitle: plannedItem.subtitle ?? '',
      type: plannedItem.kind,
      duration_min: plannedItem.durationMin ?? 60,
    }
  } else if (firstDone) {
    legacyWorkout = {
      title: firstDone.title,
      subtitle:
        firstDone.type === 'run' && firstDone.distanceMeters != null
          ? `${(firstDone.distanceMeters / 1000).toFixed(1)} km`
          : '',
      type: firstDone.type,
      duration_min:
        firstDone.actualDurationSeconds != null ? Math.round(firstDone.actualDurationSeconds / 60) : 0,
    }
  }

  const completedWorkout =
    firstDone && firstDone.actualId
      ? {
          id: firstDone.actualId,
          started_at: firstDone.actualStartedAt ?? '',
          duration_seconds: firstDone.actualDurationSeconds ?? null,
          exercises: firstDone.exercises ?? [],
        }
      : undefined

  return {
    date,
    dayLabel,
    dayName,
    isToday,
    tokens,
    status: tokens.length === 0 ? 'rest' : status,
    workout: legacyWorkout,
    completedWorkout,
  }
})
```

De bestaande `lastPerformance`-verrijking (Step 4-5 in het oude bestand) blijft ongewijzigd:
hij leest `plannedTitles` en hangt `lastPerformance` aan de planned gym-tokens. `dayName` blijft
in `DayEntry`; `getAmsterdamDayIndex`/`getWeekDates` blijven zoals ze zijn.

> **Let op (executor):** dit is de meest delicate stap (13 consumers). Verifieer met Task 10 +
> handmatig dat Home onveranderd oogt behalve het bedoelde cross-day-gedrag.

- [ ] **Step 3: Vervang het lokale `titlesMatch` door de gedeelde**

Verwijder de lokale `titlesMatch` (regels ~169-171) en importeer indien nog nodig
`titlesMatch` uit `@/lib/training/reconcile-week`.

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm vitest run tests/lib/training && pnpm tsc --noEmit`
Expected: PASS, geen type-errors.

- [ ] **Step 5: Handmatige verificatie Home**

Run: `pnpm dev`, open `/` (home). Controleer dat de week-strip ongewijzigd oogt voor normale
dagen, en dat een cross-day-verplaatste sessie nu consistent met de Schema-tab toont.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/schema/week/ tests/lib/training/schema-week-characterisation.test.ts
git commit -m "feat(schema): unify week endpoint on shared matcher (Home == Schema)"
```

---

## Verificatie tegen Stefs echte data (spec §11)

- [ ] Controleer of Stefs Hevy-workout-titels na canonicalisatie samenvallen met de
      schema-focus-namen (bv. focus `"Lower B — Hinge Dominant"` → `"lower b"` vs Hevy
      `"Lower B"` → `"lower b"`). Zo niet (echt andere woorden), open een vervolgstory voor een
      handmatige "dit was \<geplande sessie\>"-koppeling. **Niet** in dit plan oplossen.

---

## Self-review (uitgevoerd)

**Spec-dekking:**
- §4 header/§5 `SchemaBlockHeader` → Task 4. §4 Kaart 1 week-kiezer → Task 6. §5 `SchemaProgress`
  verwijderen → Task 7. §4 Kaart 2 ingeklapt + tokens → Task 8. §7 Net gestart → Task 5/7.
  §6 reconcile-lib + canonicalisatie → Task 1; `/api/schema` → Task 2; `/api/schema/week` →
  Task 10-11. §8 styling → Task 6/8. §11 verificatie → eigen sectie.
- Punt 1 → Task 5/7. Punt 2 → Task 6/7. Punt 3 → Task 1/2.

**Type-consistentie:** `reconcileWeek`/`canon`/`titlesMatch`/`ReconciledItem`/`PlannedSession`/
`CompletionInput`/`ActivityKind` consistent over Task 1/2/10/11. `toTokens` consistent over
Task 10/11. `SchemaData.createdAt` (Task 3) gebruikt in Task 5/7.

**Placeholder-scan:** Geen TBD/TODO en geen skeleton-`// ...`. Task 11 Step 2 is volledig
uitgeschreven (complete code), maar blijft de delicate stap (13 consumers) — daarom de
characterisation-test (Task 10) en handmatige Home-check ervoor.
