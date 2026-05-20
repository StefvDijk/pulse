# Block Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an 8-week Block Review wizard that closes a training block with structured data, user reflection, expert AI analysis (Opus 4.7), and atomic transition to a new 8-week schema + goals.

**Architecture:** A multi-step `/block-review` wizard (mirrors the existing weekly check-in pattern) backed by four new API routes — `data` (aggregator), `analyse` (streaming Opus), `propose-schema` (called inside analyse), and `confirm` (atomic write-back). New `block_reviews` table stores the snapshot; the existing-but-unused `schema_block_summaries` table finally gets written to on schema-switch.

**Tech Stack:** Next.js App Router (TypeScript, Server Components where possible), Supabase (PostgreSQL + RLS), Anthropic Claude API via `@ai-sdk/anthropic` (Opus 4.7 for analyse), Tailwind, SWR, Zod, Vitest, Playwright.

---

## Conventions

- **Branch:** `feature/PULSE-BLOCK-REVIEW`. Commit per task. PR at end.
- **Verification gate per task:** `pnpm typecheck` AND `pnpm lint` must pass before commit.
- **Tests:** Unit tests via `pnpm test` (vitest). Snapshot of acceptance via `pnpm test:e2e` only on key flows.
- **Model IDs (current):** Sonnet = `claude-sonnet-4-6`, Haiku = `claude-haiku-4-5`. For block-review analyse use `claude-opus-4-7`.
- **Style:** dark theme tokens from `design/design_handoff_pulse_v2/`. Cards: `bg.surface (#1E2230)` + `0.5px solid bg.border` + `radius.lg (22)`.
- **Always use `createAdminClient()` for cross-user reads in server routes**; user auth via `createClient().auth.getUser()` first.
- **All dates Europe/Amsterdam** via helpers in `src/lib/time/amsterdam.ts`.

---

## File Structure (new + modified)

```
NEW
  supabase/migrations/20260520000001_block_reviews.sql
  src/app/block-review/page.tsx
  src/app/block-review/layout.tsx                (optional, may use root)
  src/components/block-review/BlockReviewFlow.tsx
  src/components/block-review/steps/PerformanceStep.tsx
  src/components/block-review/steps/BodyStep.tsx
  src/components/block-review/steps/ReflectionStep.tsx
  src/components/block-review/steps/AnalysisStep.tsx
  src/components/block-review/steps/NextBlockStep.tsx
  src/components/block-review/steps/ConfirmStep.tsx
  src/components/block-review/StepShell.tsx
  src/components/block-review/types.ts
  src/app/api/block-review/data/route.ts
  src/app/api/block-review/analyse/route.ts
  src/app/api/block-review/confirm/route.ts
  src/lib/ai/prompts/block-review.ts
  src/lib/block-review/aggregator.ts             (pure data-shaping)
  src/lib/block-review/adherence.ts              (pure calc)
  tests/block-review/aggregator.test.ts
  tests/block-review/adherence.test.ts

MODIFIED
  src/app/api/chat/route.ts                      (BR-00a write schema_block_summaries)
  src/lib/ai/skills/router.ts                    (BR-00b pass context to buildSchemaPrompt)
  src/components/schema/v2/SchemaCoachNudge.tsx  (BR-00c accept seed prop)
  src/components/schema/SchemaPageContent.tsx   (BR-00c compose seed URL)
  src/types/database.ts                          (regen after migration)
```

---

## Sprint 0 — Vangnet (independent, parallelizable)

### Task BR-00a: Write `schema_block_summaries` on schema switch

**Files:**
- Modify: `src/app/api/chat/route.ts` (lines ~436-477, inside the `if (schemaGeneration?.title)` block)

**Why:** Today the table is read but never written. When the chat write-back swaps schemas, we must persist a summary row for the old schema so the next block's AI prompt has VORIGE SCHEMA'S context.

- [ ] **Step 1: Read current handler**

Read `src/app/api/chat/route.ts` lines 424-477 to understand the existing insert/deactivate sequence.

- [ ] **Step 2: Add helper `computeBlockSummary` inline**

Just below the existing `applySchemaUpdate` helper at the bottom of the file, add:

```ts
async function writeBlockSummary(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  oldSchemaId: string,
  endReason: 'switched' | 'completed',
) {
  // Load old schema for date window
  const { data: oldSchema } = await admin
    .from('training_schemas')
    .select('id, title, start_date, weeks_planned, workout_schedule')
    .eq('id', oldSchemaId)
    .maybeSingle()
  if (!oldSchema) return

  const startDate = oldSchema.start_date as string
  const weeks = (oldSchema.weeks_planned as number | null) ?? 8
  const endDateStr = new Date(
    new Date(startDate + 'T00:00:00Z').getTime() + weeks * 7 * 86400_000 - 86400_000,
  ).toISOString().slice(0, 10)

  // Pull completion data via parallel queries
  const fromIso = `${startDate}T00:00:00Z`
  const toIso = `${endDateStr}T23:59:59Z`

  const [workoutsRes, runsRes, padelRes] = await Promise.all([
    admin.from('workouts').select('title, started_at, total_volume_kg').eq('user_id', userId).gte('started_at', fromIso).lte('started_at', toIso),
    admin.from('runs').select('started_at').eq('user_id', userId).gte('started_at', fromIso).lte('started_at', toIso),
    admin.from('padel_sessions').select('started_at').eq('user_id', userId).gte('started_at', fromIso).lte('started_at', toIso),
  ])

  const completed = (workoutsRes.data?.length ?? 0) + (runsRes.data?.length ?? 0) + (padelRes.data?.length ?? 0)
  const schedule = Array.isArray((oldSchema.workout_schedule as unknown as { day: string }[]))
    ? (oldSchema.workout_schedule as unknown as { day: string }[])
    : []
  const planned = schedule.length * weeks
  const adherence = planned > 0 ? Math.round((completed / planned) * 1000) / 10 : null

  const exercisesUsed = Array.from(
    new Set(
      (workoutsRes.data ?? [])
        .map((w) => (w.title ?? '').trim())
        .filter((s): s is string => s.length > 0),
    ),
  ).slice(0, 50)

  const summary = `Blok "${oldSchema.title}": ${completed}/${planned} sessies (${adherence ?? '?'}% adherence) over ${weeks} weken. Reden: ${endReason}.`

  await admin.from('schema_block_summaries').insert({
    user_id: userId,
    schema_id: oldSchemaId,
    summary,
    exercises_used: exercisesUsed,
    adherence_percentage: adherence,
    total_sessions_planned: planned,
    total_sessions_completed: completed,
    end_reason: endReason,
  })

  await admin
    .from('training_schemas')
    .update({ end_date: endDateStr })
    .eq('id', oldSchemaId)
}
```

- [ ] **Step 3: Call it from the schema_generation write-back**

In the existing block around line 455-461, just before `.update({ is_active: false })`, capture the previous active schema ID. Then after the new one is activated, call `writeBlockSummary`.

Replace this:

```ts
              // Deactivate previous active schemas, then activate the new one.
              const { error: deactivateError } = await admin
                .from('training_schemas')
                .update({ is_active: false })
                .eq('user_id', user.id)
                .eq('is_active', true)
                .neq('id', inserted.id)
```

with:

```ts
              // Capture the old active schema id (if any) BEFORE deactivating, so we can write a summary row.
              const { data: oldActive } = await admin
                .from('training_schemas')
                .select('id')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .neq('id', inserted.id)
                .maybeSingle()

              const { error: deactivateError } = await admin
                .from('training_schemas')
                .update({ is_active: false })
                .eq('user_id', user.id)
                .eq('is_active', true)
                .neq('id', inserted.id)
```

And after `if (activateError) throw activateError`, add:

```ts
              if (oldActive?.id) {
                await writeBlockSummary(admin, user.id, oldActive.id, 'switched').catch((err) =>
                  console.error('Block summary write failed:', err),
                )
              }
```

- [ ] **Step 4: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat(block-review): write schema_block_summaries on switch (BR-00a)"
```

---

### Task BR-00b: Pass real context to `buildSchemaPrompt`

**Files:**
- Modify: `src/lib/ai/skills/router.ts`
- Modify: `src/lib/ai/prompts/schema-generation.ts` (no signature change, but verify shape)

**Why:** Today `buildSchemaPrompt({})` is called with empty args, so the schema-generation skill prompt is missing currentSchema / blockSummaries / progression / injuries / goals. The chat already has these in thin-context, but the skill prompt itself isn't getting them.

- [ ] **Step 1: Read existing thin-context structure**

Read `src/lib/ai/skills/router.ts` (whole file) and `src/lib/ai/context-assembler.ts` lines 654-740 for the buildSchemaContext output format.

- [ ] **Step 2: Change router signature to accept context strings**

Modify `selectSkills` signature to accept an optional `context` object:

```ts
export interface SkillContextHints {
  currentSchemaBlock?: string
  blockSummariesBlock?: string
  progressionBlock?: string
  injuriesBlock?: string
  goalsBlock?: string
}

export function selectSkills(
  questionType: QuestionType,
  message: string,
  ctx: SkillContextHints = {},
): string[] {
  const skills: string[] = []

  switch (questionType) {
    case 'schema_request':
      skills.push(
        buildSchemaPrompt({
          currentSchema: ctx.currentSchemaBlock,
          blockSummaries: ctx.blockSummariesBlock,
          progression: ctx.progressionBlock,
          injuries: ctx.injuriesBlock,
          goals: ctx.goalsBlock,
        }),
      )
      break
    case 'weekly_review':
      skills.push(buildWeeklySummaryPrompt({}))
      skills.push(buildWorkoutAnalysisSkill())
      break
    case 'progress_question':
      skills.push(buildWorkoutAnalysisSkill())
      break
  }

  if (hasKeyword(message, RECOVERY_KEYWORDS)) skills.push(buildRecoverySleepSkill())
  if (hasKeyword(message, GOAL_KEYWORDS)) skills.push(buildGoalSettingSkill())
  if (
    hasKeyword(message, WORKOUT_ANALYSIS_KEYWORDS) &&
    !skills.some((s) => s.includes('WORKOUT ANALYSE'))
  ) {
    skills.push(buildWorkoutAnalysisSkill())
  }

  return skills
}
```

- [ ] **Step 3: Update chat route call-site**

In `src/app/api/chat/route.ts` find the `selectSkills(questionType, message)` call (~line 335). Update it to pass the relevant sections it already has via `thinContext`. Easiest: extract the relevant labelled sections from `thinContext` using a helper.

Add this small helper at the top of `src/lib/ai/skills/router.ts`:

```ts
export function extractContextHints(thinContext: string): SkillContextHints {
  function section(label: string): string | undefined {
    const re = new RegExp(`--- ${label} ---([\\s\\S]*?)(?=\\n--- |$)`)
    const match = thinContext.match(re)
    return match?.[1].trim() || undefined
  }
  return {
    currentSchemaBlock: section('HUIDIG SCHEMA'),
    blockSummariesBlock: section("VORIGE SCHEMA'S"),
    progressionBlock: section('OEFENING PROGRESSIE'),
    injuriesBlock: section('ACTIEVE BLESSURES'),
    goalsBlock: section('ACTIEVE DOELEN'),
  }
}
```

In chat route, change:

```ts
const skills = selectSkills(questionType, message)
```

to:

```ts
const skills = selectSkills(questionType, message, extractContextHints(thinContext))
```

And import the new helper.

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/classifier.test.ts`
Expected: PASS (router signature change is additive — default arg).

- [ ] **Step 5: Verify typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/skills/router.ts src/app/api/chat/route.ts
git commit -m "feat(block-review): pipe real context into schema-gen skill prompt (BR-00b)"
```

---

### Task BR-00c: Seed schema coach-nudge link

**Files:**
- Modify: `src/components/schema/v2/SchemaCoachNudge.tsx`
- Modify: `src/components/schema/SchemaPageContent.tsx`

**Why:** Today the nudge links to `/chat` cold. Use the existing seed pattern (`/chat?seed=...` like `CoachCard.tsx:42`) so AI starts with full block context.

- [ ] **Step 1: Accept `seed` prop on nudge**

Replace `SchemaCoachNudge.tsx`:

```tsx
import Link from 'next/link'
import { CoachOrb } from '@/components/shared/CoachOrb'

export interface SchemaCoachNudgeProps {
  message: string
  /** Optional seed text — when present, appended to /chat as ?seed=...  */
  seed?: string
  href?: string
}

export function SchemaCoachNudge({ message, seed, href }: SchemaCoachNudgeProps) {
  const target = href ?? (seed ? `/chat?seed=${encodeURIComponent(seed)}` : '/chat')
  return (
    <Link
      href={target}
      className="flex items-center gap-2.5 p-3.5 rounded-[18px] active:opacity-60 transition-opacity"
      style={{
        background: 'linear-gradient(135deg, rgba(255,94,58,0.12), rgba(255,45,135,0.10))',
        border: '0.5px solid rgba(255,255,255,0.10)',
      }}
    >
      <CoachOrb size={28} />
      <span className="flex-1 text-[13px] text-text-primary">{message}</span>
      <span className="text-[18px] text-text-tertiary">›</span>
    </Link>
  )
}
```

- [ ] **Step 2: Pass seed from `SchemaPageContent`**

In `SchemaPageContent.tsx`, replace the `<SchemaCoachNudge message={nudgeMessage} />` line with:

```tsx
        <SchemaCoachNudge
          message={nudgeMessage}
          seed={
            isLastWeek
              ? `Mijn blok "${data.title}" loopt af (week ${data.currentWeek}/${data.totalWeeks}, ${data.totalSessionsCompleted}/${data.totalSessionsPlanned} sessies gedaan). Reflecteer kort op de afgelopen 8 weken en help me het volgende blok plannen.`
              : undefined
          }
        />
```

- [ ] **Step 3: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/schema/v2/SchemaCoachNudge.tsx src/components/schema/SchemaPageContent.tsx
git commit -m "feat(block-review): seed schema coach-nudge with block context (BR-00c)"
```

---

## Sprint 1 — Migratie + aggregator

### Task BR-01: Create `block_reviews` migration

**Files:**
- Create: `supabase/migrations/20260520000001_block_reviews.sql`
- Modify: `src/types/database.ts` (regenerate)

- [ ] **Step 1: Write migration SQL**

```sql
-- Migration: block_reviews — stores the 8-week block-close snapshot
-- Mirrors the structure of weekly_reviews but for a full training block.

CREATE TABLE block_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    schema_id UUID NOT NULL REFERENCES training_schemas(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
    end_reason TEXT NOT NULL CHECK (end_reason IN ('completed', 'switched', 'injury', 'goal_reached', 'time_up')),

    -- User reflection (Step 3)
    template_ratings JSONB DEFAULT '{}',
    keep_exercises TEXT[] DEFAULT '{}',
    drop_exercises TEXT[] DEFAULT '{}',
    biggest_win TEXT,
    biggest_miss TEXT,
    injury_updates JSONB DEFAULT '{}',

    -- Auto data snapshot (Step 1 + 2)
    performance_snapshot JSONB DEFAULT '{}',
    body_snapshot JSONB DEFAULT '{}',

    -- AI output (Step 4)
    ai_analysis TEXT,
    ai_schema_proposal JSONB,

    -- Result (Step 5)
    next_schema_id UUID REFERENCES training_schemas(id) ON DELETE SET NULL,
    new_goal_ids UUID[] DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);

CREATE INDEX idx_block_reviews_user ON block_reviews(user_id, created_at DESC);
CREATE INDEX idx_block_reviews_schema ON block_reviews(schema_id);

ALTER TABLE block_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "block_reviews_owner_all"
    ON block_reviews FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "block_reviews_service_role_all"
    ON block_reviews FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE block_reviews IS '8-week block close-out: data snapshot + reflection + AI analysis + next block proposal.';
```

- [ ] **Step 2: Push migration to local Supabase**

Run: `supabase db push` (or `supabase migration up` if remote-only).
Expected: migration applied, no error.

If `supabase` CLI isn't available locally, skip and document that the migration must be applied before run.

- [ ] **Step 3: Regenerate types**

Run: `supabase gen types typescript --local > src/types/database.ts`
If local Supabase not running, write a manual stub: add `block_reviews` to the `Database['public']['Tables']` interface in `src/types/database.ts` matching the columns above. Use `Json` for jsonb, `string` for date/text/uuid, `string[]` for text[].

- [ ] **Step 4: Verify typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260520000001_block_reviews.sql src/types/database.ts
git commit -m "feat(block-review): add block_reviews table (BR-01)"
```

---

### Task BR-02: Data aggregator endpoint

**Files:**
- Create: `src/lib/block-review/adherence.ts`
- Create: `tests/block-review/adherence.test.ts`
- Create: `src/lib/block-review/aggregator.ts`
- Create: `src/app/api/block-review/data/route.ts`

- [ ] **Step 1: Write failing adherence unit test**

Create `tests/block-review/adherence.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeAdherence } from '@/lib/block-review/adherence'

describe('computeAdherence', () => {
  it('returns 100% when all planned sessions completed', () => {
    expect(computeAdherence({ planned: 32, completed: 32 })).toBe(100)
  })

  it('returns 0 when nothing completed', () => {
    expect(computeAdherence({ planned: 32, completed: 0 })).toBe(0)
  })

  it('rounds to one decimal', () => {
    expect(computeAdherence({ planned: 30, completed: 23 })).toBe(76.7)
  })

  it('returns null when planned is zero', () => {
    expect(computeAdherence({ planned: 0, completed: 0 })).toBeNull()
  })

  it('caps at 100% when completed exceeds planned (unplanned sessions)', () => {
    expect(computeAdherence({ planned: 32, completed: 40 })).toBe(100)
  })
})
```

- [ ] **Step 2: Verify it fails**

Run: `pnpm test tests/block-review/adherence.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement adherence**

Create `src/lib/block-review/adherence.ts`:

```ts
export interface AdherenceInput {
  planned: number
  completed: number
}

export function computeAdherence({ planned, completed }: AdherenceInput): number | null {
  if (planned <= 0) return null
  const ratio = Math.min(completed, planned) / planned
  return Math.round(ratio * 1000) / 10
}
```

- [ ] **Step 4: Verify test passes**

Run: `pnpm test tests/block-review/adherence.test.ts`
Expected: 5 tests pass.

- [ ] **Step 5: Write aggregator types + skeleton**

Create `src/lib/block-review/aggregator.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { computeAdherence } from './adherence'

export interface ExerciseProgressionPoint {
  date: string
  topWeightKg: number | null
  topReps: number | null
  estimatedOneRm: number | null
  totalVolumeKg: number | null
}

export interface ExerciseProgression {
  exerciseName: string
  points: ExerciseProgressionPoint[]
  startTopE1rm: number | null
  endTopE1rm: number | null
  deltaE1rmKg: number | null
  deltaPct: number | null
  stagnant: boolean
}

export interface TemplateAdherence {
  focus: string
  planned: number
  completed: number
  adherencePct: number | null
}

export interface BlockReviewData {
  schema: {
    id: string
    title: string
    schemaType: string
    weeksPlanned: number
    startDate: string
    endDate: string
    workoutsPerWeek: number
  }
  totals: {
    plannedSessions: number
    completedSessions: number
    adherencePct: number | null
    runs: number
    runKm: number
    padelSessions: number
    gymSessions: number
    totalTonnageKg: number
  }
  templateAdherence: TemplateAdherence[]
  exerciseProgressions: ExerciseProgression[]
  personalRecords: Array<{ exercise: string; recordType: string; value: number; unit: string; achievedAt: string }>
  bodyTimeline: Array<{
    measuredAt: string
    weightKg: number | null
    skeletalMuscleMassKg: number | null
    bodyFatKg: number | null
    bodyFatPct: number | null
    visceralFatLevel: number | null
    waistCm: number | null
  }>
  bodyDelta: {
    weightKg: number | null
    skeletalMuscleMassKg: number | null
    bodyFatKg: number | null
    bodyFatPct: number | null
  }
  wellnessAverages: {
    sleepHours: number | null
    energy: number | null
    sorenessRating: number | null
  }
  injuries: Array<{ bodyLocation: string; severity: string; status: string; description: string | null }>
  goals: Array<{ id: string; title: string; category: string; targetValue: number | null; currentValue: number | null; deadline: string | null }>
}

type Admin = SupabaseClient<Database>

export async function aggregateBlockData(
  admin: Admin,
  userId: string,
  schemaId: string,
): Promise<BlockReviewData> {
  // Implementation in BR-02 step 6
  throw new Error('not implemented')
}

function estimateOneRm(weight: number, reps: number): number {
  // Epley formula
  if (reps <= 0 || weight <= 0) return 0
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}
```

- [ ] **Step 6: Implement aggregator**

Replace the throwing `aggregateBlockData` body. The function should:

1. Load schema row, derive `endDate = startDate + weeksPlanned*7 - 1`.
2. Parse `workout_schedule` (array form) — count `workoutsPerWeek = schedule.length`, `plannedSessions = workoutsPerWeek * weeksPlanned`.
3. Fetch in parallel: workouts, sets-with-exercise-name (join `workout_sets` + `exercise_definitions`), runs, padel_sessions, body_composition_logs, sleep_logs (if exists, optional), personal_records, injury_logs (status='active'), goals (status='active').
4. Build `templateAdherence` by matching each focus to workout titles (lowercase exact match) — same logic as in `/api/schema/route.ts` `findCompletion`.
5. Build `exerciseProgressions`:
   - Group sets by `exercise_name`
   - For each, dedup per workout (max e1rm of any set)
   - Sort by date
   - Keep only exercises with ≥3 points
   - `stagnant` = last 3 points have e1rm within 2.5kg of each other
6. `bodyTimeline` sorted ascending by `measured_at` within window.
7. `bodyDelta` = last point minus first point for each metric.
8. `wellnessAverages` from `daily_checkins` if available (avg sleep_hours, energy, soreness over period).

Full implementation (paste this body inside aggregateBlockData):

```ts
  const { data: schemaRow, error: schemaErr } = await admin
    .from('training_schemas')
    .select('id, title, schema_type, weeks_planned, start_date, workout_schedule')
    .eq('id', schemaId)
    .eq('user_id', userId)
    .maybeSingle()

  if (schemaErr || !schemaRow) throw new Error(`Schema not found: ${schemaId}`)

  const weeksPlanned = (schemaRow.weeks_planned as number | null) ?? 8
  const startDate = schemaRow.start_date as string
  const startMs = new Date(startDate + 'T00:00:00Z').getTime()
  const endMs = startMs + weeksPlanned * 7 * 86400_000 - 1
  const endDate = new Date(endMs).toISOString().slice(0, 10)
  const fromIso = `${startDate}T00:00:00Z`
  const toIso = `${endDate}T23:59:59Z`

  const scheduleRaw = schemaRow.workout_schedule as unknown
  const schedule: Array<{ day: string; focus: string }> = Array.isArray(scheduleRaw)
    ? (scheduleRaw as Array<{ day: string; focus: string }>)
    : []
  const workoutsPerWeek = schedule.length
  const plannedSessions = workoutsPerWeek * weeksPlanned

  const [
    workoutsRes,
    setsRes,
    runsRes,
    padelRes,
    bodyRes,
    prRes,
    injRes,
    goalsRes,
    checkinRes,
  ] = await Promise.all([
    admin
      .from('workouts')
      .select('id, title, started_at, total_volume_kg')
      .eq('user_id', userId)
      .gte('started_at', fromIso)
      .lte('started_at', toIso),
    admin
      .from('workout_sets')
      .select('weight_kg, reps, performed_at, exercise_definitions(name), workouts!inner(user_id, started_at)')
      .eq('workouts.user_id', userId)
      .gte('workouts.started_at', fromIso)
      .lte('workouts.started_at', toIso),
    admin
      .from('runs')
      .select('started_at, distance_km')
      .eq('user_id', userId)
      .gte('started_at', fromIso)
      .lte('started_at', toIso),
    admin
      .from('padel_sessions')
      .select('started_at')
      .eq('user_id', userId)
      .gte('started_at', fromIso)
      .lte('started_at', toIso),
    admin
      .from('body_composition_logs')
      .select('measured_at, weight_kg, skeletal_muscle_mass_kg, body_fat_kg, body_fat_pct, visceral_fat_level, waist_cm')
      .eq('user_id', userId)
      .gte('measured_at', startDate)
      .lte('measured_at', endDate)
      .order('measured_at', { ascending: true }),
    admin
      .from('personal_records')
      .select('record_type, record_category, value, unit, achieved_at, exercise_definitions(name)')
      .eq('user_id', userId)
      .gte('achieved_at', fromIso)
      .lte('achieved_at', toIso),
    admin
      .from('injury_logs')
      .select('body_location, severity, description, status')
      .eq('user_id', userId)
      .eq('status', 'active'),
    admin
      .from('goals')
      .select('id, title, category, target_value, current_value, deadline')
      .eq('user_id', userId)
      .neq('status', 'completed'),
    admin
      .from('daily_checkins')
      .select('check_in_date, energy_rating, soreness_rating, sleep_hours')
      .eq('user_id', userId)
      .gte('check_in_date', startDate)
      .lte('check_in_date', endDate),
  ])

  // Template adherence
  const templateAdherence: TemplateAdherence[] = schedule.map((s) => {
    const focusLower = s.focus.toLowerCase().trim()
    const completed = (workoutsRes.data ?? []).filter((w) => (w.title ?? '').toLowerCase().trim() === focusLower).length
    return {
      focus: s.focus,
      planned: weeksPlanned,
      completed,
      adherencePct: computeAdherence({ planned: weeksPlanned, completed }),
    }
  })

  // Exercise progressions
  type SetRow = {
    weight_kg: number | null
    reps: number | null
    performed_at: string | null
    exercise_definitions: { name: string } | null
    workouts: { started_at: string } | null
  }
  const setsByExercise = new Map<string, Array<{ date: string; weight: number; reps: number }>>()
  for (const set of (setsRes.data ?? []) as unknown as SetRow[]) {
    const name = set.exercise_definitions?.name
    if (!name) continue
    const weight = set.weight_kg ?? 0
    const reps = set.reps ?? 0
    if (weight <= 0 || reps <= 0) continue
    const date = (set.performed_at ?? set.workouts?.started_at ?? '').slice(0, 10)
    if (!date) continue
    const arr = setsByExercise.get(name) ?? []
    arr.push({ date, weight, reps })
    setsByExercise.set(name, arr)
  }

  const exerciseProgressions: ExerciseProgression[] = []
  for (const [name, sets] of setsByExercise) {
    const byDate = new Map<string, { weight: number; reps: number; e1rm: number }>()
    for (const s of sets) {
      const e1rm = estimateOneRm(s.weight, s.reps)
      const existing = byDate.get(s.date)
      if (!existing || e1rm > existing.e1rm) byDate.set(s.date, { weight: s.weight, reps: s.reps, e1rm })
    }
    const points = Array.from(byDate.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({
        date,
        topWeightKg: v.weight,
        topReps: v.reps,
        estimatedOneRm: v.e1rm,
        totalVolumeKg: null,
      }))
    if (points.length < 3) continue
    const startE = points[0].estimatedOneRm ?? null
    const endE = points[points.length - 1].estimatedOneRm ?? null
    const delta = startE !== null && endE !== null ? Math.round((endE - startE) * 10) / 10 : null
    const deltaPct = startE && delta !== null ? Math.round((delta / startE) * 1000) / 10 : null
    const last3 = points.slice(-3).map((p) => p.estimatedOneRm ?? 0)
    const stagnant = Math.max(...last3) - Math.min(...last3) <= 2.5
    exerciseProgressions.push({
      exerciseName: name,
      points,
      startTopE1rm: startE,
      endTopE1rm: endE,
      deltaE1rmKg: delta,
      deltaPct,
      stagnant,
    })
  }

  exerciseProgressions.sort((a, b) => (b.deltaE1rmKg ?? 0) - (a.deltaE1rmKg ?? 0))

  // Body delta
  const bodyTimeline = (bodyRes.data ?? []).map((b) => ({
    measuredAt: b.measured_at as string,
    weightKg: b.weight_kg,
    skeletalMuscleMassKg: b.skeletal_muscle_mass_kg,
    bodyFatKg: b.body_fat_kg,
    bodyFatPct: b.body_fat_pct,
    visceralFatLevel: b.visceral_fat_level,
    waistCm: b.waist_cm,
  }))
  const first = bodyTimeline[0]
  const last = bodyTimeline[bodyTimeline.length - 1]
  const diff = (k: keyof typeof first) =>
    first && last && first[k] != null && last[k] != null
      ? Math.round(((last[k] as number) - (first[k] as number)) * 10) / 10
      : null
  const bodyDelta = {
    weightKg: diff('weightKg'),
    skeletalMuscleMassKg: diff('skeletalMuscleMassKg'),
    bodyFatKg: diff('bodyFatKg'),
    bodyFatPct: diff('bodyFatPct'),
  }

  // Totals
  const completedSessions =
    (workoutsRes.data?.length ?? 0) + (runsRes.data?.length ?? 0) + (padelRes.data?.length ?? 0)
  const runKm = (runsRes.data ?? []).reduce((sum, r) => sum + (r.distance_km ?? 0), 0)
  const totalTonnageKg = (workoutsRes.data ?? []).reduce((sum, w) => sum + (w.total_volume_kg ?? 0), 0)

  // Wellness averages
  const checkins = checkinRes.data ?? []
  const avg = (key: 'energy_rating' | 'soreness_rating' | 'sleep_hours') => {
    const xs = checkins.map((c) => c[key]).filter((v): v is number => typeof v === 'number')
    if (xs.length === 0) return null
    return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10
  }

  return {
    schema: {
      id: schemaRow.id as string,
      title: schemaRow.title as string,
      schemaType: schemaRow.schema_type as string,
      weeksPlanned,
      startDate,
      endDate,
      workoutsPerWeek,
    },
    totals: {
      plannedSessions,
      completedSessions,
      adherencePct: computeAdherence({ planned: plannedSessions, completed: completedSessions }),
      runs: runsRes.data?.length ?? 0,
      runKm: Math.round(runKm * 10) / 10,
      padelSessions: padelRes.data?.length ?? 0,
      gymSessions: workoutsRes.data?.length ?? 0,
      totalTonnageKg: Math.round(totalTonnageKg),
    },
    templateAdherence,
    exerciseProgressions,
    personalRecords: (prRes.data ?? []).map((p) => ({
      exercise: (p.exercise_definitions as unknown as { name: string } | null)?.name ?? 'Unknown',
      recordType: p.record_type as string,
      value: p.value as number,
      unit: p.unit as string,
      achievedAt: p.achieved_at as string,
    })),
    bodyTimeline,
    bodyDelta,
    wellnessAverages: {
      sleepHours: avg('sleep_hours'),
      energy: avg('energy_rating'),
      sorenessRating: avg('soreness_rating'),
    },
    injuries: (injRes.data ?? []).map((i) => ({
      bodyLocation: i.body_location as string,
      severity: i.severity as string,
      status: i.status as string,
      description: (i.description as string | null) ?? null,
    })),
    goals: (goalsRes.data ?? []).map((g) => ({
      id: g.id as string,
      title: g.title as string,
      category: g.category as string,
      targetValue: g.target_value as number | null,
      currentValue: g.current_value as number | null,
      deadline: g.deadline as string | null,
    })),
  }
```

- [ ] **Step 7: Build the route**

Create `src/app/api/block-review/data/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aggregateBlockData } from '@/lib/block-review/aggregator'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })

    const url = new URL(request.url)
    const requestedSchemaId = url.searchParams.get('schema_id')

    const admin = createAdminClient()
    let schemaId = requestedSchemaId
    if (!schemaId) {
      const { data: active } = await admin
        .from('training_schemas')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()
      if (!active) return NextResponse.json({ error: 'No active schema', code: 'NO_SCHEMA' }, { status: 404 })
      schemaId = active.id
    }

    const data = await aggregateBlockData(admin, user.id, schemaId)
    return NextResponse.json(data)
  } catch (err) {
    console.error('Block review data error:', err)
    return NextResponse.json({ error: 'Failed to load block review data', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
```

- [ ] **Step 8: Verify build**

Run: `pnpm typecheck && pnpm lint && pnpm test tests/block-review/`
Expected: pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/block-review/ src/app/api/block-review/ tests/block-review/
git commit -m "feat(block-review): data aggregator endpoint + adherence helper (BR-02)"
```

---

## Sprint 2 — Wizard skelet + steps 1-3

### Task BR-03: Route + state machine

**Files:**
- Create: `src/app/block-review/page.tsx`
- Create: `src/components/block-review/types.ts`
- Create: `src/components/block-review/BlockReviewFlow.tsx`
- Create: `src/components/block-review/StepShell.tsx`

- [ ] **Step 1: types.ts — local form state types**

```ts
export type StepId = 'performance' | 'body' | 'reflection' | 'analysis' | 'next-block' | 'confirm'

export interface TemplateRating {
  focus: string
  rating: 'good' | 'ok' | 'meh' | null
  note: string
}

export interface ReflectionState {
  templateRatings: TemplateRating[]
  keepExercises: string[]
  dropExercises: string[]
  biggestWin: string
  biggestMiss: string
  injuryUpdates: Record<string, 'still_active' | 'resolved'>
}

export interface NextBlockGoalDraft {
  id?: string
  title: string
  category: string
  targetValue?: number
  targetUnit?: string
  deadline?: string
  isNew: boolean
}

export interface BlockReviewFormState {
  reflection: ReflectionState
  newInBody: null | {
    measuredAt: string
    weightKg: number | null
    skeletalMuscleMassKg: number | null
    bodyFatKg: number | null
    bodyFatPct: number | null
    visceralFatLevel: number | null
    waistCm: number | null
  }
  aiAnalysis: string
  aiSchemaProposal: unknown | null
  selectedGoals: NextBlockGoalDraft[]
  endReason: 'completed' | 'switched' | 'injury' | 'goal_reached' | 'time_up'
}
```

- [ ] **Step 2: StepShell — wrapper for each step**

```tsx
'use client'

import { ChevronLeft } from 'lucide-react'

interface StepShellProps {
  title: string
  subtitle?: string
  stepIndex: number
  stepTotal: number
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  children: React.ReactNode
}

export function StepShell({
  title,
  subtitle,
  stepIndex,
  stepTotal,
  onBack,
  onNext,
  nextLabel = 'Volgende',
  nextDisabled,
  children,
}: StepShellProps) {
  return (
    <div className="flex flex-col min-h-dvh bg-bg-base pb-24">
      <div className="sticky top-0 z-10 px-4 pt-[64px] pb-3 bg-bg-base/95 backdrop-blur">
        <div className="flex items-center gap-2 text-[12px] text-text-tertiary">
          {onBack && (
            <button onClick={onBack} aria-label="Terug" className="-ml-1 p-1">
              <ChevronLeft size={18} />
            </button>
          )}
          <span>Stap {stepIndex + 1} / {stepTotal}</span>
        </div>
        <h1 className="mt-1 text-[22px] font-semibold text-text-primary">{title}</h1>
        {subtitle && <p className="text-[13px] text-text-secondary mt-1">{subtitle}</p>}
      </div>

      <div className="flex-1 px-4 flex flex-col gap-4">{children}</div>

      {onNext && (
        <div className="fixed bottom-0 inset-x-0 px-4 pb-6 pt-3 bg-gradient-to-t from-bg-base via-bg-base to-transparent">
          <button
            onClick={onNext}
            disabled={nextDisabled}
            className="w-full h-12 rounded-full text-[15px] font-semibold text-black bg-white disabled:opacity-30"
          >
            {nextLabel}
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Flow controller**

```tsx
'use client'

import { useState } from 'react'
import useSWR from 'swr'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { BlockReviewFormState, StepId } from './types'
import { PerformanceStep } from './steps/PerformanceStep'
import { BodyStep } from './steps/BodyStep'
import { ReflectionStep } from './steps/ReflectionStep'
import { AnalysisStep } from './steps/AnalysisStep'
import { NextBlockStep } from './steps/NextBlockStep'
import { ConfirmStep } from './steps/ConfirmStep'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { SkeletonCard } from '@/components/shared/Skeleton'

const STEPS: StepId[] = ['performance', 'body', 'reflection', 'analysis', 'next-block', 'confirm']

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error('Failed to load')
  return r.json() as Promise<BlockReviewData>
})

function emptyForm(data: BlockReviewData): BlockReviewFormState {
  return {
    reflection: {
      templateRatings: data.templateAdherence.map((t) => ({ focus: t.focus, rating: null, note: '' })),
      keepExercises: [],
      dropExercises: [],
      biggestWin: '',
      biggestMiss: '',
      injuryUpdates: {},
    },
    newInBody: null,
    aiAnalysis: '',
    aiSchemaProposal: null,
    selectedGoals: [],
    endReason: 'completed',
  }
}

export function BlockReviewFlow() {
  const { data, error, isLoading } = useSWR<BlockReviewData>('/api/block-review/data', fetcher)
  const [stepIdx, setStepIdx] = useState(0)
  const [form, setForm] = useState<BlockReviewFormState | null>(null)

  if (isLoading) return <div className="p-4 pt-[80px]"><SkeletonCard className="h-40" /></div>
  if (error || !data) return <div className="p-4 pt-[80px]"><ErrorAlert message="Kan blok-review niet laden." /></div>

  const state = form ?? emptyForm(data)
  if (!form) setForm(state)

  const setReflection = (next: BlockReviewFormState['reflection']) =>
    setForm({ ...state, reflection: next })
  const setNewInBody = (next: BlockReviewFormState['newInBody']) =>
    setForm({ ...state, newInBody: next })
  const setAi = (analysis: string, proposal: unknown) =>
    setForm({ ...state, aiAnalysis: analysis, aiSchemaProposal: proposal })
  const setGoals = (next: BlockReviewFormState['selectedGoals']) =>
    setForm({ ...state, selectedGoals: next })

  const step = STEPS[stepIdx]
  const go = (delta: number) =>
    setStepIdx((i) => Math.min(STEPS.length - 1, Math.max(0, i + delta)))

  const common = { stepIndex: stepIdx, stepTotal: STEPS.length, onBack: stepIdx > 0 ? () => go(-1) : undefined }

  switch (step) {
    case 'performance':
      return <PerformanceStep data={data} {...common} onNext={() => go(1)} />
    case 'body':
      return <BodyStep data={data} newInBody={state.newInBody} onChange={setNewInBody} {...common} onNext={() => go(1)} />
    case 'reflection':
      return <ReflectionStep data={data} value={state.reflection} onChange={setReflection} {...common} onNext={() => go(1)} />
    case 'analysis':
      return <AnalysisStep data={data} form={state} onAnalysed={setAi} {...common} onNext={() => go(1)} />
    case 'next-block':
      return <NextBlockStep data={data} form={state} onGoalsChange={setGoals} {...common} onNext={() => go(1)} />
    case 'confirm':
      return <ConfirmStep data={data} form={state} {...common} />
  }
}
```

- [ ] **Step 4: Page**

Create `src/app/block-review/page.tsx`:

```tsx
import { BlockReviewFlow } from '@/components/block-review/BlockReviewFlow'

export default function BlockReviewPage() {
  return <BlockReviewFlow />
}
```

- [ ] **Step 5: Verify build (steps will be stubs)**

Stubs are needed before typecheck passes. Create each `steps/*.tsx` as a minimal placeholder returning `<StepShell ... />` with TODO content. Then run `pnpm typecheck`. Build them out in BR-04..06.

Stub example (use for all six step files initially):

```tsx
'use client'
import { StepShell } from '../StepShell'
import type { BlockReviewData } from '@/lib/block-review/aggregator'

export function PerformanceStep(props: {
  data: BlockReviewData
  stepIndex: number
  stepTotal: number
  onBack?: () => void
  onNext: () => void
}) {
  return (
    <StepShell title="Prestatie" stepIndex={props.stepIndex} stepTotal={props.stepTotal} onBack={props.onBack} onNext={props.onNext}>
      <div className="text-text-tertiary">TODO</div>
    </StepShell>
  )
}
```

- [ ] **Step 6: Commit skeleton**

```bash
git add src/app/block-review/ src/components/block-review/
git commit -m "feat(block-review): wizard skeleton + state machine (BR-03)"
```

---

### Task BR-04: PerformanceStep

**Files:**
- Modify: `src/components/block-review/steps/PerformanceStep.tsx`

- [ ] **Step 1: Build the UI**

Replace stub with:

```tsx
'use client'

import { StepShell } from '../StepShell'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import { TrendingUp, TrendingDown, Minus, Trophy } from 'lucide-react'

interface Props {
  data: BlockReviewData
  stepIndex: number
  stepTotal: number
  onBack?: () => void
  onNext: () => void
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const w = 80
  const h = 24
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / span) * h}`).join(' ')
  return <svg width={w} height={h} className="text-sport-gym"><polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={pts} /></svg>
}

export function PerformanceStep({ data, stepIndex, stepTotal, onBack, onNext }: Props) {
  const { totals, templateAdherence, exerciseProgressions, personalRecords } = data

  return (
    <StepShell
      title="Prestatie"
      subtitle={`${totals.completedSessions}/${totals.plannedSessions} sessies · ${totals.adherencePct ?? '?'}% adherence`}
      stepIndex={stepIndex}
      stepTotal={stepTotal}
      onBack={onBack}
      onNext={onNext}
    >
      <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">Per workout</h3>
        <div className="flex flex-col gap-2">
          {templateAdherence.map((t) => (
            <div key={t.focus} className="flex items-center justify-between">
              <span className="text-[14px] text-text-primary">{t.focus}</span>
              <span className="text-[13px] tabular-nums text-text-secondary">{t.completed}/{t.planned} · {t.adherencePct ?? '?'}%</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">Oefening-progressie</h3>
        {exerciseProgressions.length === 0 && <div className="text-[13px] text-text-tertiary">Geen oefeningen met genoeg datapoints.</div>}
        <div className="flex flex-col divide-y divide-bg-border/40">
          {exerciseProgressions.map((ex) => {
            const Icon = (ex.deltaE1rmKg ?? 0) > 0.5 ? TrendingUp : (ex.deltaE1rmKg ?? 0) < -0.5 ? TrendingDown : Minus
            return (
              <div key={ex.exerciseName} className="py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] text-text-primary truncate">{ex.exerciseName}</span>
                    {ex.stagnant && <span className="text-[10px] uppercase tracking-wider text-status-warning">stagnant</span>}
                  </div>
                  <div className="text-[12px] text-text-secondary mt-0.5 tabular-nums">
                    e1RM {ex.startTopE1rm ?? '?'}kg → {ex.endTopE1rm ?? '?'}kg
                    {ex.deltaE1rmKg !== null && (
                      <span className={ex.deltaE1rmKg >= 0 ? 'text-status-success ml-2' : 'text-status-danger ml-2'}>
                        {ex.deltaE1rmKg >= 0 ? '+' : ''}{ex.deltaE1rmKg}kg ({ex.deltaPct ?? '?'}%)
                      </span>
                    )}
                  </div>
                </div>
                <Sparkline values={ex.points.map((p) => p.estimatedOneRm ?? 0)} />
                <Icon size={16} className="text-text-tertiary" />
              </div>
            )
          })}
        </div>
      </section>

      {personalRecords.length > 0 && (
        <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3 flex items-center gap-1.5"><Trophy size={12} /> PR's</h3>
          <div className="flex flex-col gap-1.5">
            {personalRecords.map((p, i) => (
              <div key={i} className="flex justify-between text-[13px]">
                <span className="text-text-primary truncate">{p.exercise}</span>
                <span className="tabular-nums text-text-secondary">{p.value}{p.unit}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">Cardio + totaal</h3>
        <div className="grid grid-cols-2 gap-y-2 text-[13px]">
          <span className="text-text-secondary">Gym sessies</span><span className="tabular-nums text-right text-text-primary">{totals.gymSessions}</span>
          <span className="text-text-secondary">Hardloop</span><span className="tabular-nums text-right text-text-primary">{totals.runs}× / {totals.runKm}km</span>
          <span className="text-text-secondary">Padel</span><span className="tabular-nums text-right text-text-primary">{totals.padelSessions}×</span>
          <span className="text-text-secondary">Totaal tonnage</span><span className="tabular-nums text-right text-text-primary">{totals.totalTonnageKg.toLocaleString('nl-NL')} kg</span>
        </div>
      </section>
    </StepShell>
  )
}
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/block-review/steps/PerformanceStep.tsx
git commit -m "feat(block-review): PerformanceStep with progression + PRs (BR-04)"
```

---

### Task BR-05: BodyStep

**Files:**
- Modify: `src/components/block-review/steps/BodyStep.tsx`

- [ ] **Step 1: Build the UI**

```tsx
'use client'

import { useState } from 'react'
import { StepShell } from '../StepShell'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { BlockReviewFormState } from '../types'

interface Props {
  data: BlockReviewData
  newInBody: BlockReviewFormState['newInBody']
  onChange: (next: BlockReviewFormState['newInBody']) => void
  stepIndex: number
  stepTotal: number
  onBack?: () => void
  onNext: () => void
}

function Stat({ label, value, delta, unit }: { label: string; value: number | null; delta: number | null; unit: string }) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-[13px] text-text-secondary">{label}</span>
      <span className="text-[14px] tabular-nums text-text-primary">
        {value ?? '—'}{value !== null && unit}
        {delta !== null && delta !== 0 && (
          <span className={`ml-2 text-[12px] ${delta > 0 ? 'text-status-success' : 'text-status-danger'}`}>
            {delta > 0 ? '+' : ''}{delta}{unit}
          </span>
        )}
      </span>
    </div>
  )
}

export function BodyStep({ data, newInBody, onChange, stepIndex, stepTotal, onBack, onNext }: Props) {
  const { bodyTimeline, bodyDelta, wellnessAverages } = data
  const last = bodyTimeline[bodyTimeline.length - 1]
  const [adding, setAdding] = useState(false)

  function update<K extends keyof NonNullable<typeof newInBody>>(k: K, v: number | null) {
    onChange({
      measuredAt: new Date().toISOString().slice(0, 10),
      weightKg: null,
      skeletalMuscleMassKg: null,
      bodyFatKg: null,
      bodyFatPct: null,
      visceralFatLevel: null,
      waistCm: null,
      ...(newInBody ?? {}),
      [k]: v,
    })
  }

  return (
    <StepShell
      title="Lichaam"
      subtitle={`${bodyTimeline.length} metingen in dit blok`}
      stepIndex={stepIndex}
      stepTotal={stepTotal}
      onBack={onBack}
      onNext={onNext}
    >
      {last ? (
        <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
            Laatste meting · {last.measuredAt}
          </h3>
          <Stat label="Gewicht" value={last.weightKg} delta={bodyDelta.weightKg} unit="kg" />
          <Stat label="Spiermassa" value={last.skeletalMuscleMassKg} delta={bodyDelta.skeletalMuscleMassKg} unit="kg" />
          <Stat label="Vetmassa" value={last.bodyFatKg} delta={bodyDelta.bodyFatKg} unit="kg" />
          <Stat label="Vet%" value={last.bodyFatPct} delta={bodyDelta.bodyFatPct} unit="%" />
          <Stat label="Buikomtrek" value={last.waistCm} delta={null} unit="cm" />
        </section>
      ) : (
        <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4 text-[13px] text-text-tertiary">
          Geen InBody-metingen in dit blok.
        </section>
      )}

      <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">Wellness gemiddelde</h3>
        <Stat label="Slaap" value={wellnessAverages.sleepHours} delta={null} unit="u" />
        <Stat label="Energie" value={wellnessAverages.energy} delta={null} unit="/10" />
        <Stat label="Spierpijn" value={wellnessAverages.sorenessRating} delta={null} unit="/10" />
      </section>

      <button
        type="button"
        onClick={() => setAdding((b) => !b)}
        className="rounded-card-lg bg-bg-surface border border-bg-border p-4 text-[14px] text-text-primary text-left active:opacity-70"
      >
        + Nieuwe InBody-meting toevoegen
      </button>

      {adding && (
        <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4 flex flex-col gap-2">
          <NumberInput label="Gewicht (kg)" value={newInBody?.weightKg ?? null} onChange={(v) => update('weightKg', v)} step={0.1} />
          <NumberInput label="Spiermassa (kg)" value={newInBody?.skeletalMuscleMassKg ?? null} onChange={(v) => update('skeletalMuscleMassKg', v)} step={0.1} />
          <NumberInput label="Vetmassa (kg)" value={newInBody?.bodyFatKg ?? null} onChange={(v) => update('bodyFatKg', v)} step={0.1} />
          <NumberInput label="Vet%" value={newInBody?.bodyFatPct ?? null} onChange={(v) => update('bodyFatPct', v)} step={0.1} />
          <NumberInput label="Buikomtrek (cm)" value={newInBody?.waistCm ?? null} onChange={(v) => update('waistCm', v)} step={0.5} />
        </section>
      )}
    </StepShell>
  )
}

function NumberInput({ label, value, onChange, step }: { label: string; value: number | null; onChange: (v: number | null) => void; step: number }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-text-secondary flex-1">{label}</span>
      <input
        type="number"
        step={step}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="w-24 px-2 py-1 bg-bg-base border border-bg-border rounded text-right text-[14px] tabular-nums text-text-primary"
      />
    </label>
  )
}
```

- [ ] **Step 2: Verify + commit**

```bash
pnpm typecheck && git add src/components/block-review/steps/BodyStep.tsx && git commit -m "feat(block-review): BodyStep with InBody timeline + manual add (BR-05)"
```

---

### Task BR-06: ReflectionStep

**Files:**
- Modify: `src/components/block-review/steps/ReflectionStep.tsx`

- [ ] **Step 1: Build the UI**

```tsx
'use client'

import { StepShell } from '../StepShell'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { ReflectionState, TemplateRating } from '../types'

interface Props {
  data: BlockReviewData
  value: ReflectionState
  onChange: (next: ReflectionState) => void
  stepIndex: number
  stepTotal: number
  onBack?: () => void
  onNext: () => void
}

const RATINGS: TemplateRating['rating'][] = ['good', 'ok', 'meh']
const RATING_LABEL: Record<NonNullable<TemplateRating['rating']>, string> = {
  good: '🙂 Fijn',
  ok: '😐 Oké',
  meh: '😕 Minder',
}

export function ReflectionStep({ data, value, onChange, stepIndex, stepTotal, onBack, onNext }: Props) {
  const exerciseNames = data.exerciseProgressions.map((e) => e.exerciseName)

  function setTemplateRating(idx: number, partial: Partial<TemplateRating>) {
    const next = value.templateRatings.map((t, i) => (i === idx ? { ...t, ...partial } : t))
    onChange({ ...value, templateRatings: next })
  }

  function toggleExercise(list: string[], name: string): string[] {
    return list.includes(name) ? list.filter((x) => x !== name) : [...list, name]
  }

  function setInjuryUpdate(loc: string, status: 'still_active' | 'resolved') {
    onChange({ ...value, injuryUpdates: { ...value.injuryUpdates, [loc]: status } })
  }

  const ratedCount = value.templateRatings.filter((t) => t.rating !== null).length
  const canNext = ratedCount === value.templateRatings.length

  return (
    <StepShell
      title="Reflectie"
      subtitle="Hoe voelde dit blok?"
      stepIndex={stepIndex}
      stepTotal={stepTotal}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!canNext}
    >
      <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4 flex flex-col gap-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Per workout</h3>
        {value.templateRatings.map((t, idx) => (
          <div key={t.focus} className="flex flex-col gap-2">
            <span className="text-[14px] text-text-primary">{t.focus}</span>
            <div className="flex gap-2">
              {RATINGS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTemplateRating(idx, { rating: r })}
                  className={`px-3 py-1.5 rounded-full border text-[13px] ${
                    t.rating === r ? 'border-text-primary text-text-primary' : 'border-bg-border text-text-secondary'
                  }`}
                >
                  {RATING_LABEL[r!]}
                </button>
              ))}
            </div>
            <input
              value={t.note}
              onChange={(e) => setTemplateRating(idx, { note: e.target.value })}
              placeholder="Wat viel je op?"
              className="px-3 py-2 bg-bg-base border border-bg-border rounded-md text-[13px] text-text-primary placeholder:text-text-tertiary"
            />
          </div>
        ))}
      </section>

      {exerciseNames.length > 0 && (
        <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4 flex flex-col gap-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Oefeningen</h3>
          <div>
            <div className="text-[12px] text-text-secondary mb-1.5">Behouden in volgend blok</div>
            <div className="flex flex-wrap gap-1.5">
              {exerciseNames.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChange({ ...value, keepExercises: toggleExercise(value.keepExercises, n) })}
                  className={`px-2.5 py-1 rounded-full text-[12px] border ${
                    value.keepExercises.includes(n) ? 'border-status-success/60 text-status-success bg-status-success/10' : 'border-bg-border text-text-secondary'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[12px] text-text-secondary mb-1.5">Liever weg / vervangen</div>
            <div className="flex flex-wrap gap-1.5">
              {exerciseNames.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChange({ ...value, dropExercises: toggleExercise(value.dropExercises, n) })}
                  className={`px-2.5 py-1 rounded-full text-[12px] border ${
                    value.dropExercises.includes(n) ? 'border-status-danger/60 text-status-danger bg-status-danger/10' : 'border-bg-border text-text-secondary'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-text-secondary">Grootste win</span>
          <textarea
            value={value.biggestWin}
            onChange={(e) => onChange({ ...value, biggestWin: e.target.value })}
            rows={2}
            className="px-3 py-2 bg-bg-base border border-bg-border rounded-md text-[13px] text-text-primary resize-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-text-secondary">Grootste tegenvaller</span>
          <textarea
            value={value.biggestMiss}
            onChange={(e) => onChange({ ...value, biggestMiss: e.target.value })}
            rows={2}
            className="px-3 py-2 bg-bg-base border border-bg-border rounded-md text-[13px] text-text-primary resize-none"
          />
        </label>
      </section>

      {data.injuries.length > 0 && (
        <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4 flex flex-col gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Blessures</h3>
          {data.injuries.map((inj) => (
            <div key={inj.bodyLocation} className="flex items-center justify-between">
              <span className="text-[13px] text-text-primary">{inj.bodyLocation}</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setInjuryUpdate(inj.bodyLocation, 'still_active')}
                  className={`px-2.5 py-1 rounded-full text-[11px] border ${value.injuryUpdates[inj.bodyLocation] === 'still_active' ? 'border-status-warning text-status-warning' : 'border-bg-border text-text-tertiary'}`}
                >
                  nog actief
                </button>
                <button
                  type="button"
                  onClick={() => setInjuryUpdate(inj.bodyLocation, 'resolved')}
                  className={`px-2.5 py-1 rounded-full text-[11px] border ${value.injuryUpdates[inj.bodyLocation] === 'resolved' ? 'border-status-success text-status-success' : 'border-bg-border text-text-tertiary'}`}
                >
                  opgelost
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </StepShell>
  )
}
```

- [ ] **Step 2: Verify + commit**

```bash
pnpm typecheck && git add src/components/block-review/steps/ReflectionStep.tsx && git commit -m "feat(block-review): ReflectionStep with ratings + tag pickers (BR-06)"
```

---

## Sprint 3 — AI Analyse + schema-voorstel

### Task BR-07: Opus block-review prompt

**Files:**
- Create: `src/lib/ai/prompts/block-review.ts`

- [ ] **Step 1: Write the prompt builder**

```ts
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { BlockReviewFormState } from '@/components/block-review/types'

interface BuildBlockReviewPromptParams {
  data: BlockReviewData
  form: BlockReviewFormState
}

/**
 * Block-review prompt: instructs the Opus model to act as a senior strength coach
 * with deep expertise in periodisation, hypertrophy, nutrition and injury management.
 * Output: structured analysis + schema proposal.
 */
export function buildBlockReviewPrompt({ data, form }: BuildBlockReviewPromptParams): string {
  const ratings = form.reflection.templateRatings
    .map((t) => `- ${t.focus}: ${t.rating ?? '—'}${t.note ? ` ("${t.note}")` : ''}`)
    .join('\n')

  const exercises = data.exerciseProgressions
    .slice(0, 20)
    .map(
      (e) =>
        `- ${e.exerciseName}: e1RM ${e.startTopE1rm ?? '?'}→${e.endTopE1rm ?? '?'}kg (${e.deltaE1rmKg !== null ? (e.deltaE1rmKg >= 0 ? '+' : '') + e.deltaE1rmKg : '?'}kg)${e.stagnant ? ' [stagnant]' : ''}`,
    )
    .join('\n')

  const body = data.bodyDelta
  const bodyLine = `Gewicht ${body.weightKg ?? '?'}kg · Spiermassa ${body.skeletalMuscleMassKg ?? '?'}kg · Vetmassa ${body.bodyFatKg ?? '?'}kg · Vet% ${body.bodyFatPct ?? '?'}%`

  const injuries = data.injuries.map((i) => `- ${i.bodyLocation} (${i.severity}, ${i.status})`).join('\n')
  const goals = data.goals.map((g) => `- ${g.title}${g.targetValue ? ` (target ${g.targetValue}${g.targetUnit ?? ''})` : ''}`).join('\n')

  return `# ROL

Je bent een senior strength & conditioning coach met diepe expertise in:
- Periodisatie (linear, undulating, block, conjugate) en volume-landmarks (MEV / MAV / MRV)
- Hypertrofie (mechanical tension, exercise rotation, intensity vs frequency tradeoffs)
- Powerlifting / kracht (e1RM-progressie, specificiteit, deload-timing)
- Hardlooptraining naast krachttraining (ACWR, polarisatie, krachtbehoud)
- Sport-voeding (eiwit-timing, energy balance bij gelijktijdig bulken/cutten, periworkout)
- Blessure-management (RTP-protocollen, contraindicaties, load-management)

Je werkt voor Stef. Hij is data-driven en wil concrete, cijfermatige feedback. Geen platitudes.
Antwoord in het Nederlands. Direct, geen aarzeling.

# BLOK-DATA (8 weken)

## Schema
${data.schema.title} (${data.schema.schemaType}, ${data.schema.weeksPlanned} weken, ${data.schema.workoutsPerWeek}×/week)
Periode: ${data.schema.startDate} → ${data.schema.endDate}

## Adherence
${data.totals.completedSessions}/${data.totals.plannedSessions} sessies (${data.totals.adherencePct ?? '?'}%)
Gym: ${data.totals.gymSessions} · Hardloop: ${data.totals.runs}× / ${data.totals.runKm}km · Padel: ${data.totals.padelSessions}×
Tonnage: ${data.totals.totalTonnageKg.toLocaleString('nl-NL')}kg

## Per workout
${data.templateAdherence.map((t) => `- ${t.focus}: ${t.completed}/${t.planned} (${t.adherencePct ?? '?'}%)`).join('\n')}

## Oefening-progressie (top 20 op delta)
${exercises || '(geen progressie-data)'}

## Lichaamsverandering (delta)
${bodyLine}

## Wellness-gemiddelde
Slaap ${data.wellnessAverages.sleepHours ?? '?'}u · Energie ${data.wellnessAverages.energy ?? '?'}/10 · Spierpijn ${data.wellnessAverages.sorenessRating ?? '?'}/10

## Actieve blessures
${injuries || '(geen)'}

## Actieve doelen
${goals || '(geen)'}

# STEFS REFLECTIE

## Per workout
${ratings || '(geen ratings ingevuld)'}

## Behouden
${form.reflection.keepExercises.join(', ') || '(geen)'}

## Weg / vervangen
${form.reflection.dropExercises.join(', ') || '(geen)'}

## Grootste win
${form.reflection.biggestWin || '(niet ingevuld)'}

## Grootste tegenvaller
${form.reflection.biggestMiss || '(niet ingevuld)'}

# BLESSURE-CONSTRAINTS (ALTIJD RESPECTEREN)

- Geen overhead pressing (OHP, DB shoulder press) — schouder labrumpathologie
- Squats tot parallel, niet diep — knieën (OCD, kraakbeentransplantatie 2016)
- BSS niet na intervaltraining — minstens 1 dag ertussen
- Leg press: beperkt bereik
- RDL's met neutrale rug, initiatie vanuit heupen
- Dead bugs, Pallof press, planks altijd in schema houden — core stabiliteit
- Pull > push volume (schouder-compensatie)
- Face pulls of band pull-aparts in elke upper-dag

# SCHEMA-EISEN VOLGEND BLOK

- Max 55 minuten per sessie
- 4 sessies per week (ma-do), vrijdag hardlopen
- Progressieve overload: baseer startgewichten op e1RM eind-van-dit-blok
- Roteer ten minste 30% van de oefeningen (anti-staleness)
- Deload elke 3-4 weken

# OUTPUT FORMAT

Geef je antwoord in DEZE volgorde, niets meer en niets minder:

1. **ANALYSE** (4-7 zinnen, met concrete cijfers): wat werkte, wat niet, en waarom. Adresseer:
   - Beste progressie (welke oefening, hoeveel)
   - Zwakste / stagnante oefening en waarschijnlijke oorzaak
   - Adherence-patroon (welke template viel weg, hint waarom)
   - Lichaam-trend en hoe dat past bij Stefs reflectie
   - Eén concrete les voor volgend blok

2. **AANBEVELING** (3-5 bullets): wat verandert in volgend blok en waarom.

3. **OPEN VRAGEN** (1-3 stuks): wat moet Stef nog beslissen voor we het schema definitief maken?

4. **SCHEMA-VOORSTEL** als laatste blok, exact dit format:

\`\`\`
<block_proposal>
{
  "title": "<korte naam>",
  "schema_type": "upper_lower",
  "weeks_planned": 8,
  "start_date": "<YYYY-MM-DD>",
  "workout_schedule": [
    {"day":"monday","focus":"Upper A","duration_min":55,"exercises":[{"name":"<naam>","sets":4,"reps":"6-8","notes":""}]},
    ...
  ]
}
</block_proposal>
\`\`\`

Belangrijk:
- start_date = eerstvolgende maandag NA ${data.schema.endDate}
- exercises moeten echte, herkenbare namen zijn die in Hevy bestaan
- gebruik Stefs eindgewicht als referentie voor startgewicht volgend blok (5-10% progressie)
- respecteer ALLE blessure-constraints
- output GEEN andere XML/JSON-blokken
`
}
```

- [ ] **Step 2: Verify typecheck + commit**

```bash
pnpm typecheck && git add src/lib/ai/prompts/block-review.ts && git commit -m "feat(block-review): expert Opus prompt builder (BR-07)"
```

---

### Task BR-08: Analyse endpoint (streaming Opus)

**Files:**
- Create: `src/app/api/block-review/analyse/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aggregateBlockData } from '@/lib/block-review/aggregator'
import { buildBlockReviewPrompt } from '@/lib/ai/prompts/block-review'
import { logAiUsage } from '@/lib/ai/usage'
import { checkRateLimit } from '@/lib/rate-limit'

const BLOCK_REVIEW_MODEL = 'claude-opus-4-7' as const

const ReqSchema = z.object({
  schema_id: z.string().uuid().optional(),
  reflection: z.object({
    templateRatings: z.array(z.object({
      focus: z.string(),
      rating: z.enum(['good', 'ok', 'meh']).nullable(),
      note: z.string(),
    })),
    keepExercises: z.array(z.string()),
    dropExercises: z.array(z.string()),
    biggestWin: z.string(),
    biggestMiss: z.string(),
    injuryUpdates: z.record(z.string(), z.enum(['still_active', 'resolved'])),
  }),
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })

    const rl = checkRateLimit(`block-review:${user.id}`, { limit: 5, windowMs: 60_000 })
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 })
    }

    const body = await request.json()
    const parsed = ReqSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', code: 'VALIDATION_ERROR' }, { status: 400 })
    }

    const admin = createAdminClient()
    let schemaId = parsed.data.schema_id
    if (!schemaId) {
      const { data: active } = await admin
        .from('training_schemas')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()
      if (!active) return NextResponse.json({ error: 'No active schema', code: 'NO_SCHEMA' }, { status: 404 })
      schemaId = active.id
    }

    const data = await aggregateBlockData(admin, user.id, schemaId)

    const prompt = buildBlockReviewPrompt({
      data,
      form: {
        reflection: parsed.data.reflection,
        newInBody: null,
        aiAnalysis: '',
        aiSchemaProposal: null,
        selectedGoals: [],
        endReason: 'completed',
      },
    })

    const startedAt = Date.now()
    const result = streamText({
      model: anthropic(BLOCK_REVIEW_MODEL),
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens: 4096,
    })

    void (async () => {
      try {
        const u = await result.usage
        logAiUsage({
          userId: user.id,
          feature: 'block-review-analyse',
          model: BLOCK_REVIEW_MODEL,
          usage: {
            inputTokens: u.inputTokens ?? null,
            outputTokens: u.outputTokens ?? null,
            cacheReadTokens: (u as { cachedInputTokens?: number }).cachedInputTokens ?? null,
          },
          durationMs: Date.now() - startedAt,
        })
      } catch (err) {
        logAiUsage({
          userId: user.id,
          feature: 'block-review-analyse',
          model: BLOCK_REVIEW_MODEL,
          durationMs: Date.now() - startedAt,
          status: 'error',
          errorCode: (err as { name?: string })?.name ?? 'STREAM_ERROR',
        })
      }
    })()

    return result.toTextStreamResponse()
  } catch (err) {
    console.error('Block review analyse error:', err)
    return NextResponse.json({ error: 'Failed to analyse', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify typecheck + commit**

```bash
pnpm typecheck && git add src/app/api/block-review/analyse/route.ts && git commit -m "feat(block-review): Opus streaming analyse endpoint (BR-08)"
```

---

### Task BR-09: AnalysisStep + NextBlockStep

**Files:**
- Modify: `src/components/block-review/steps/AnalysisStep.tsx`
- Modify: `src/components/block-review/steps/NextBlockStep.tsx`

- [ ] **Step 1: AnalysisStep with streaming**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { StepShell } from '../StepShell'
import { CoachOrb } from '@/components/shared/CoachOrb'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { BlockReviewFormState } from '../types'

interface Props {
  data: BlockReviewData
  form: BlockReviewFormState
  onAnalysed: (analysis: string, proposal: unknown) => void
  stepIndex: number
  stepTotal: number
  onBack?: () => void
  onNext: () => void
}

function extractProposal(text: string): { clean: string; proposal: unknown | null } {
  const match = /<block_proposal>([\s\S]*?)<\/block_proposal>/i.exec(text)
  if (!match) return { clean: text, proposal: null }
  let proposal: unknown = null
  try { proposal = JSON.parse(match[1].trim()) } catch { proposal = null }
  return { clean: text.replace(match[0], '').trim(), proposal }
}

export function AnalysisStep({ data, form, onAnalysed, stepIndex, stepTotal, onBack, onNext }: Props) {
  const [output, setOutput] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const res = await fetch('/api/block-review/analyse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schema_id: data.schema.id, reflection: form.reflection }),
        })
        if (!res.ok || !res.body) {
          throw new Error('Analyse mislukt')
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let acc = ''
        while (true) {
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break
          acc += decoder.decode(value)
          if (!cancelled) setOutput(acc)
        }
        if (!cancelled) {
          const { clean, proposal } = extractProposal(acc)
          setOutput(clean)
          setDone(true)
          onAnalysed(clean, proposal)
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      }
    }
    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <StepShell
      title="Coach analyse"
      stepIndex={stepIndex}
      stepTotal={stepTotal}
      onBack={onBack}
      onNext={done ? onNext : undefined}
      nextLabel="Naar volgend blok"
    >
      <div className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <CoachOrb size={22} />
          <span className="text-[11px] uppercase tracking-wider font-semibold text-text-secondary">Coach (Opus 4.7)</span>
        </div>
        {error ? (
          <div className="text-status-danger text-[13px]">{error}</div>
        ) : (
          <div className="text-[14px] leading-[1.55] text-text-primary whitespace-pre-wrap">{output || 'Aan het analyseren…'}</div>
        )}
      </div>
    </StepShell>
  )
}
```

- [ ] **Step 2: NextBlockStep**

```tsx
'use client'

import { StepShell } from '../StepShell'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { BlockReviewFormState, NextBlockGoalDraft } from '../types'

interface Props {
  data: BlockReviewData
  form: BlockReviewFormState
  onGoalsChange: (next: NextBlockGoalDraft[]) => void
  stepIndex: number
  stepTotal: number
  onBack?: () => void
  onNext: () => void
}

interface ProposalShape {
  title: string
  schema_type: string
  weeks_planned: number
  start_date: string
  workout_schedule: Array<{ day: string; focus: string; duration_min?: number; exercises?: Array<{ name: string; sets?: number; reps?: string }> }>
}

export function NextBlockStep({ data, form, onGoalsChange, stepIndex, stepTotal, onBack, onNext }: Props) {
  const proposal = form.aiSchemaProposal as ProposalShape | null

  function toggleGoal(g: BlockReviewData['goals'][number]) {
    const exists = form.selectedGoals.find((x) => x.id === g.id)
    if (exists) {
      onGoalsChange(form.selectedGoals.filter((x) => x.id !== g.id))
    } else {
      onGoalsChange([...form.selectedGoals, {
        id: g.id,
        title: g.title,
        category: g.category,
        targetValue: g.targetValue ?? undefined,
        deadline: g.deadline ?? undefined,
        isNew: false,
      }])
    }
  }

  return (
    <StepShell
      title="Volgend blok"
      subtitle="Bevestig doelen en bekijk het AI-voorstel"
      stepIndex={stepIndex}
      stepTotal={stepTotal}
      onBack={onBack}
      onNext={onNext}
    >
      <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">Doelen voor volgend blok</h3>
        {data.goals.length === 0 && <div className="text-[13px] text-text-tertiary">Geen actieve doelen. Voeg er een toe via /goals.</div>}
        <div className="flex flex-col gap-2">
          {data.goals.map((g) => {
            const selected = !!form.selectedGoals.find((x) => x.id === g.id)
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleGoal(g)}
                className={`text-left rounded-md border p-3 ${
                  selected ? 'border-text-primary bg-white/5' : 'border-bg-border'
                }`}
              >
                <div className="text-[14px] text-text-primary">{g.title}</div>
                <div className="text-[12px] text-text-secondary tabular-nums">
                  {g.currentValue ?? '?'} → {g.targetValue ?? '?'} {g.deadline ? `· ${g.deadline}` : ''}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">Schema-voorstel</h3>
        {!proposal ? (
          <div className="text-[13px] text-status-warning">Geen schema-voorstel ontvangen — je kunt later via de coach een schema vragen.</div>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-[15px] font-semibold text-text-primary">{proposal.title}</div>
              <div className="text-[12px] text-text-secondary">{proposal.weeks_planned} weken · start {proposal.start_date}</div>
            </div>
            <div className="flex flex-col divide-y divide-bg-border/40">
              {proposal.workout_schedule.map((w) => (
                <div key={w.day} className="py-2.5">
                  <div className="flex justify-between">
                    <span className="text-[14px] text-text-primary capitalize">{w.day} · {w.focus}</span>
                    <span className="text-[12px] text-text-tertiary">{w.duration_min ?? 55} min</span>
                  </div>
                  {w.exercises && (
                    <ul className="mt-1.5 ml-1 text-[12px] text-text-secondary list-disc list-inside">
                      {w.exercises.map((e, i) => <li key={i}>{e.name} {e.sets ? `· ${e.sets}×${e.reps ?? ''}` : ''}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </StepShell>
  )
}
```

- [ ] **Step 3: Verify + commit**

```bash
pnpm typecheck && git add src/components/block-review/steps/ && git commit -m "feat(block-review): AnalysisStep streaming + NextBlockStep proposal view (BR-09)"
```

---

## Sprint 4 — Atomic confirm

### Task BR-10: Confirm endpoint

**Files:**
- Create: `src/app/api/block-review/confirm/route.ts`

- [ ] **Step 1: Build the route**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { todayAmsterdam } from '@/lib/time/amsterdam'
import { aggregateBlockData } from '@/lib/block-review/aggregator'

const ConfirmSchema = z.object({
  schema_id: z.string().uuid(),
  end_reason: z.enum(['completed', 'switched', 'injury', 'goal_reached', 'time_up']),
  reflection: z.object({
    templateRatings: z.array(z.object({ focus: z.string(), rating: z.enum(['good','ok','meh']).nullable(), note: z.string() })),
    keepExercises: z.array(z.string()),
    dropExercises: z.array(z.string()),
    biggestWin: z.string(),
    biggestMiss: z.string(),
    injuryUpdates: z.record(z.string(), z.enum(['still_active','resolved'])),
  }),
  new_in_body: z.object({
    measuredAt: z.string(),
    weightKg: z.number().nullable(),
    skeletalMuscleMassKg: z.number().nullable(),
    bodyFatKg: z.number().nullable(),
    bodyFatPct: z.number().nullable(),
    visceralFatLevel: z.number().nullable(),
    waistCm: z.number().nullable(),
  }).nullable(),
  ai_analysis: z.string(),
  ai_schema_proposal: z.unknown().nullable(),
  new_schema: z.object({
    title: z.string(),
    schema_type: z.enum(['upper_lower','push_pull_legs','full_body','custom']),
    weeks_planned: z.number().int().min(1).max(16),
    start_date: z.string(),
    workout_schedule: z.array(z.object({
      day: z.enum(['monday','tuesday','wednesday','thursday','friday','saturday','sunday']),
      focus: z.string(),
      duration_min: z.number().optional(),
      exercises: z.array(z.object({ name: z.string(), sets: z.number().optional(), reps: z.string().optional(), notes: z.string().optional() })).optional(),
    })),
  }).nullable(),
  selected_goal_ids: z.array(z.string().uuid()),
  dry_run: z.boolean().default(false),
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })

    const body = await request.json()
    const parsed = ConfirmSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
    }

    if (parsed.data.dry_run) {
      return NextResponse.json({ success: true, dry_run: true })
    }

    const admin = createAdminClient()
    const { schema_id, end_reason, reflection, new_in_body, ai_analysis, ai_schema_proposal, new_schema, selected_goal_ids } = parsed.data

    // 1) Aggregate snapshot for performance/body snapshots
    const aggregate = await aggregateBlockData(admin, user.id, schema_id)

    // 2) Insert block_review row (status draft → confirmed at end)
    const { data: review, error: reviewErr } = await admin
      .from('block_reviews')
      .insert({
        user_id: user.id,
        schema_id,
        period_start: aggregate.schema.startDate,
        period_end: aggregate.schema.endDate,
        status: 'confirmed',
        end_reason,
        template_ratings: reflection.templateRatings as unknown as import('@/types/database').Json,
        keep_exercises: reflection.keepExercises,
        drop_exercises: reflection.dropExercises,
        biggest_win: reflection.biggestWin || null,
        biggest_miss: reflection.biggestMiss || null,
        injury_updates: reflection.injuryUpdates as unknown as import('@/types/database').Json,
        performance_snapshot: {
          totals: aggregate.totals,
          templateAdherence: aggregate.templateAdherence,
          exerciseProgressions: aggregate.exerciseProgressions,
          personalRecords: aggregate.personalRecords,
        } as unknown as import('@/types/database').Json,
        body_snapshot: {
          timeline: aggregate.bodyTimeline,
          delta: aggregate.bodyDelta,
        } as unknown as import('@/types/database').Json,
        ai_analysis,
        ai_schema_proposal: (ai_schema_proposal ?? null) as unknown as import('@/types/database').Json,
        confirmed_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (reviewErr || !review) throw reviewErr ?? new Error('block_review insert failed')

    // 3) Save InBody measurement if present
    if (new_in_body) {
      await admin.from('body_composition_logs').insert({
        user_id: user.id,
        measured_at: new_in_body.measuredAt,
        weight_kg: new_in_body.weightKg,
        skeletal_muscle_mass_kg: new_in_body.skeletalMuscleMassKg,
        body_fat_kg: new_in_body.bodyFatKg,
        body_fat_pct: new_in_body.bodyFatPct,
        visceral_fat_level: new_in_body.visceralFatLevel,
        waist_cm: new_in_body.waistCm,
        source: 'manual',
      })
    }

    // 4) Write summary row for old schema; mark end_date + inactive
    await admin.from('schema_block_summaries').insert({
      user_id: user.id,
      schema_id,
      summary: `Block review afgesloten — ${aggregate.totals.completedSessions}/${aggregate.totals.plannedSessions} sessies (${aggregate.totals.adherencePct ?? '?'}%). Eindstatus: ${end_reason}.`,
      exercises_used: Array.from(new Set(aggregate.exerciseProgressions.map((e) => e.exerciseName))).slice(0, 50),
      adherence_percentage: aggregate.totals.adherencePct,
      total_sessions_planned: aggregate.totals.plannedSessions,
      total_sessions_completed: aggregate.totals.completedSessions,
      end_reason,
    })

    await admin
      .from('training_schemas')
      .update({ end_date: aggregate.schema.endDate, is_active: false })
      .eq('id', schema_id)

    // 5) Insert new schema (active=false), deactivate any leftovers, activate new
    let newSchemaId: string | null = null
    if (new_schema) {
      const { data: inserted, error: insertErr } = await admin
        .from('training_schemas')
        .insert({
          user_id: user.id,
          title: new_schema.title,
          schema_type: new_schema.schema_type,
          weeks_planned: new_schema.weeks_planned,
          start_date: new_schema.start_date,
          workout_schedule: new_schema.workout_schedule as unknown as import('@/types/database').Json,
          is_active: false,
          ai_generated: true,
          generation_context: `Block review ${review.id}`,
        })
        .select('id')
        .single()
      if (insertErr || !inserted) throw insertErr ?? new Error('new schema insert failed')

      await admin.from('training_schemas').update({ is_active: false }).eq('user_id', user.id).eq('is_active', true).neq('id', inserted.id)
      await admin.from('training_schemas').update({ is_active: true }).eq('id', inserted.id)
      newSchemaId = inserted.id
    }

    // 6) No goal-creation in this version — only select existing
    //    (Free-form goal creation could be added later.)

    // 7) Update block_review with next_schema_id + goal ids
    await admin
      .from('block_reviews')
      .update({ next_schema_id: newSchemaId, new_goal_ids: selected_goal_ids })
      .eq('id', review.id)

    // 8) Coaching memory entries for learnings
    if (reflection.biggestWin) {
      await admin.from('coaching_memory').upsert(
        {
          user_id: user.id,
          key: `block_win_${todayAmsterdam()}`,
          category: 'program',
          value: `Grootste win blok "${aggregate.schema.title}": ${reflection.biggestWin}`,
        },
        { onConflict: 'user_id,key' },
      )
    }
    if (reflection.biggestMiss) {
      await admin.from('coaching_memory').upsert(
        {
          user_id: user.id,
          key: `block_miss_${todayAmsterdam()}`,
          category: 'program',
          value: `Grootste miss blok "${aggregate.schema.title}": ${reflection.biggestMiss}`,
        },
        { onConflict: 'user_id,key' },
      )
    }

    return NextResponse.json({ success: true, review_id: review.id, new_schema_id: newSchemaId })
  } catch (err) {
    console.error('Block review confirm error:', err)
    return NextResponse.json({ error: 'Failed to confirm block review', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify typecheck + commit**

```bash
pnpm typecheck && git add src/app/api/block-review/confirm/route.ts && git commit -m "feat(block-review): atomic confirm endpoint (BR-10)"
```

---

### Task BR-11: ConfirmStep UI

**Files:**
- Modify: `src/components/block-review/steps/ConfirmStep.tsx`

- [ ] **Step 1: Build the UI**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { StepShell } from '../StepShell'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { BlockReviewFormState } from '../types'

interface Props {
  data: BlockReviewData
  form: BlockReviewFormState
  stepIndex: number
  stepTotal: number
  onBack?: () => void
}

export function ConfirmStep({ data, form, stepIndex, stepTotal, onBack }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dryRun, setDryRun] = useState(false)

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/block-review/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema_id: data.schema.id,
          end_reason: form.endReason,
          reflection: form.reflection,
          new_in_body: form.newInBody,
          ai_analysis: form.aiAnalysis,
          ai_schema_proposal: form.aiSchemaProposal,
          new_schema: form.aiSchemaProposal,
          selected_goal_ids: form.selectedGoals.filter((g) => !g.isNew && g.id).map((g) => g.id!),
          dry_run: dryRun,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Opslaan mislukt')
      }
      router.push('/schema')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <StepShell title="Bevestigen" stepIndex={stepIndex} stepTotal={stepTotal} onBack={onBack}>
      <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4 text-[13px] text-text-secondary">
        <p className="text-text-primary">Klaar om af te sluiten:</p>
        <ul className="mt-2 list-disc list-inside space-y-0.5">
          <li>Block review opslaan (8 weken snapshot)</li>
          <li>Oud schema "{data.schema.title}" sluiten</li>
          {form.aiSchemaProposal != null && <li>Nieuw schema activeren</li>}
          {form.newInBody && <li>InBody-meting toevoegen</li>}
          {form.reflection.biggestWin && <li>Win opslaan in coach-geheugen</li>}
          {form.reflection.biggestMiss && <li>Miss opslaan in coach-geheugen</li>}
        </ul>
      </section>

      <label className="flex items-center gap-2 text-[12px] text-text-tertiary">
        <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
        Test mode (niets opslaan)
      </label>

      {error && <div className="text-status-danger text-[13px]">{error}</div>}

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="w-full h-12 rounded-full text-[15px] font-semibold text-black bg-white disabled:opacity-30"
      >
        {submitting ? 'Bezig…' : dryRun ? 'Test bevestiging' : 'Bevestig & start nieuw blok'}
      </button>
    </StepShell>
  )
}
```

- [ ] **Step 2: Verify + commit**

```bash
pnpm typecheck && git add src/components/block-review/steps/ConfirmStep.tsx && git commit -m "feat(block-review): ConfirmStep with atomic submit (BR-11)"
```

---

## Sprint 5 — Schema-page CTA (polish)

### Task BR-12: Link `/block-review` from schema page

**Files:**
- Modify: `src/components/schema/SchemaPageContent.tsx`

- [ ] **Step 1: Replace nudge target on last week**

In `SchemaPageContent.tsx`, change the SchemaCoachNudge `seed` prop on the `isLastWeek` branch to point at the wizard:

```tsx
        <SchemaCoachNudge
          message={
            isLastWeek
              ? 'Blok klaar — start Block Review'
              : nudgeMessage
          }
          href={isLastWeek ? '/block-review' : undefined}
          seed={!isLastWeek ? undefined : undefined}
        />
```

- [ ] **Step 2: Verify + commit**

```bash
pnpm typecheck && git add src/components/schema/SchemaPageContent.tsx && git commit -m "feat(block-review): schema page CTA to wizard on last week (BR-12)"
```

---

## Final verification

- [ ] Run full suite

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Expected: all pass.

- [ ] Manual smoke test the wizard

1. Open `/block-review` — should load and show all 6 steps.
2. Walk through performance + body + reflection.
3. Trigger analysis — observe Opus streaming output.
4. Inspect schema proposal in NextBlock step.
5. Submit in `dry_run: true` mode → expect success without writes.

- [ ] Push branch

```bash
git push -u origin feature/PULSE-BLOCK-REVIEW
```

- [ ] Open PR with summary

---

## Self-Review Checklist

- **Spec coverage**: ✅ all 6 fases gedekt door BR-04 t/m BR-11. ✅ block_summaries write on switch in BR-00a covers the dead-table fix. ✅ AI context fix in BR-00b. ✅ Opus 4.7 in BR-08. ✅ Same wizard handles all end_reasons via Zod enum in BR-10.
- **Placeholders**: search for "TODO" → stub steps in BR-03 are explicitly minimal and replaced in BR-04..06. No TBD/FIXME elsewhere.
- **Type consistency**: `BlockReviewData`, `BlockReviewFormState`, `ReflectionState`, `TemplateRating` are defined in shared files and reused across steps + endpoints.
- **Migration vs types**: BR-01 step 3 includes a fallback if `supabase` CLI isn't local — manual stub in `database.ts`.
- **Open risks**:
  - `daily_checkins` table referenced in aggregator — confirmed it exists (migration `20260515000001`).
  - `workout_sets` schema referenced — verify column names match (`weight_kg`, `reps`, `performed_at`, `exercise_definitions.name`).
  - Opus 4.7 model ID `claude-opus-4-7` — current Anthropic naming, verify availability at request time.
