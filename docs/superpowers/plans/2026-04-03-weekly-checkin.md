# Weekly Check-in v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 3-step weekly check-in flow (Review → Coach Analyse → Bevestig) that lets the user close out their training week with an AI-generated coaching summary.

**Architecture:** Server-side API routes fetch aggregated data from existing Supabase tables, pass it to Claude Sonnet for analysis, and store the result in new `weekly_reviews` and `body_composition_logs` tables. The frontend is a guided step-flow at `/check-in` using SWR hooks and the existing Pulse design system.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL + RLS), Claude Sonnet via @ai-sdk/anthropic, SWR, Tailwind CSS v4, Zod, lucide-react icons.

---

## File Structure

### New files to create

```
supabase/migrations/
  20260403000002_weekly_reviews.sql          # WC-001: weekly_reviews table
  20260403000003_body_composition_logs.sql   # WC-002: body_composition_logs table

src/app/api/check-in/review/route.ts         # WC-003: GET week review data
src/app/api/check-in/analyze/route.ts        # WC-004: POST AI analysis
src/app/api/check-in/confirm/route.ts        # WC-005: POST save review
src/app/api/body-composition/route.ts        # WC-006: GET+POST body comp

src/lib/ai/prompts/checkin-analyze.ts        # WC-004: system prompt for analysis

src/hooks/useCheckInReview.ts                # WC-007: SWR hook for review data
src/hooks/useBodyComposition.ts              # WC-006: SWR hook for body comp

src/app/check-in/page.tsx                    # WC-007: page route
src/components/check-in/CheckInFlow.tsx      # WC-007: main flow container
src/components/check-in/WeekReviewCard.tsx   # WC-007: step 1
src/components/check-in/ManualAddModal.tsx   # WC-007: modal for manual additions
src/components/check-in/CoachAnalysisCard.tsx # WC-007: step 2
src/components/check-in/ConfirmationCard.tsx # WC-007: step 3

src/components/home/CheckInBadge.tsx         # WC-008: dashboard badge
```

### Existing files to modify

```
src/types/database.ts                        # WC-001+002: regenerated after migrations
src/components/dashboard/DashboardPage.tsx    # WC-008: add CheckInBadge
```

---

## Task 1: Migration `weekly_reviews` (WC-001)

**Files:**
- Create: `supabase/migrations/20260403000002_weekly_reviews.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Migration 002: Weekly check-in reviews
-- Stores the result of the weekly check-in flow: coach summary, session stats, manual additions, InBody data.

CREATE TABLE weekly_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,

  -- Review data
  summary_text TEXT,
  sessions_planned INTEGER,
  sessions_completed INTEGER,
  highlights JSONB DEFAULT '[]',
  manual_additions JSONB DEFAULT '[]',

  -- InBody data (optional, captured during check-in)
  inbody_weight_kg NUMERIC(5,2),
  inbody_muscle_mass_kg NUMERIC(5,2),
  inbody_fat_mass_kg NUMERIC(5,2),
  inbody_fat_pct NUMERIC(4,1),
  inbody_waist_cm NUMERIC(5,1),

  -- Planning (v1.1 — placeholder columns for future calendar integration)
  next_week_plan JSONB,
  calendar_synced BOOLEAN DEFAULT FALSE,

  -- Meta
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, week_start)
);

-- RLS
ALTER TABLE weekly_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own reviews"
  ON weekly_reviews FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_weekly_reviews_user_week ON weekly_reviews(user_id, week_start DESC);

-- Auto-update updated_at
CREATE TRIGGER update_weekly_reviews_updated_at
  BEFORE UPDATE ON weekly_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 2: Apply the migration**

Run: `supabase db push`
Expected: Migration applied successfully, no errors.

- [ ] **Step 3: Verify the table exists**

Run: `supabase db reset --linked && supabase gen types typescript --local > src/types/database.ts`

Note: If running locally, use `supabase db push` first, then generate types. Verify that `weekly_reviews` appears in `src/types/database.ts` with all columns typed.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260403000002_weekly_reviews.sql
git commit -m "feat(WC-001): add weekly_reviews table with RLS and indexes"
```

---

## Task 2: Migration `body_composition_logs` (WC-002)

**Files:**
- Create: `supabase/migrations/20260403000003_body_composition_logs.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Migration 003: Body composition logs
-- Stores InBody scans and other body measurement entries for historical tracking.

CREATE TABLE body_composition_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  source TEXT DEFAULT 'inbody' CHECK (source IN ('inbody', 'manual', 'smart_scale')),
  weight_kg NUMERIC(5,2),
  muscle_mass_kg NUMERIC(5,2),
  fat_mass_kg NUMERIC(5,2),
  fat_pct NUMERIC(4,1),
  bmi NUMERIC(4,1),
  waist_cm NUMERIC(5,1),
  chest_cm NUMERIC(5,1),
  arm_right_cm NUMERIC(5,1),
  thigh_right_cm NUMERIC(5,1),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, date, source)
);

-- RLS
ALTER TABLE body_composition_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own body comp logs"
  ON body_composition_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_body_comp_user_date ON body_composition_logs(user_id, date DESC);

-- Auto-update updated_at
CREATE TRIGGER update_body_composition_logs_updated_at
  BEFORE UPDATE ON body_composition_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 2: Apply and regenerate types**

Run: `supabase db push && supabase gen types typescript --local > src/types/database.ts`
Expected: Both tables exist. `body_composition_logs` appears in `database.ts`.

- [ ] **Step 3: Verify both tables in types**

Open `src/types/database.ts` and confirm both `weekly_reviews` and `body_composition_logs` are present with correct column types. The `source` column should be typed as `string` (Supabase doesn't emit CHECK enums into types — we validate with Zod at the API layer).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260403000003_body_composition_logs.sql src/types/database.ts
git commit -m "feat(WC-002): add body_composition_logs table with RLS and indexes"
```

---

## Task 3: Check-in Review API (WC-003)

**Files:**
- Create: `src/app/api/check-in/review/route.ts`
- Create: `src/hooks/useCheckInReview.ts`

- [ ] **Step 1: Create the review API route**

This endpoint collects all relevant data for the past week. It queries multiple tables in parallel and assembles a structured response.

```typescript
// src/app/api/check-in/review/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface WorkoutSummary {
  id: string
  title: string
  date: string
  duration_min: number
  tonnage_kg: number
}

export interface RunSummary {
  id: string
  date: string
  distance_km: number
  pace: string | null
  duration_min: number
}

export interface PadelSummary {
  id: string
  date: string
  duration_min: number
  intensity: string | null
}

export interface Highlight {
  type: 'pr' | 'streak' | 'milestone'
  description: string
  value?: string
}

export interface CheckInReviewData {
  week: { start: string; end: string; number: number }
  sessions: { planned: number; completed: number }
  workouts: WorkoutSummary[]
  runs: RunSummary[]
  padel: PadelSummary[]
  nutrition: {
    avgCalories: number
    avgProtein: number
    proteinTarget: number
    calorieTarget: number
  }
  sleep: {
    avgHours: number
    worstDay: { date: string; hours: number } | null
  }
  highlights: Highlight[]
  previousReview: {
    week_start: string
    summary_text: string | null
    completed_at: string | null
  } | null
}

function getWeekBounds(dateStr?: string): { start: string; end: string; number: number } {
  const base = dateStr ? new Date(dateStr + 'T00:00:00') : new Date()
  // Find Monday of this week
  const day = base.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(base)
  monday.setDate(base.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const start = monday.toISOString().slice(0, 10)
  const end = sunday.toISOString().slice(0, 10)

  // ISO week number
  const jan4 = new Date(monday.getFullYear(), 0, 4)
  const dayOfYear = Math.floor((monday.getTime() - jan4.getTime()) / 86400000) + 4
  const weekNumber = Math.ceil(dayOfYear / 7)

  return { start, end, number: weekNumber }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const url = new URL(request.url)
    const weekStartParam = url.searchParams.get('week_start') ?? undefined
    const week = getWeekBounds(weekStartParam)

    const admin = createAdminClient()

    // Parallel queries
    const [
      weeklyAggResult,
      workoutsResult,
      runsResult,
      padelResult,
      nutritionResult,
      dailyAggResult,
      prsResult,
      prevReviewResult,
      settingsResult,
    ] = await Promise.all([
      admin
        .from('weekly_aggregations')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start', week.start)
        .maybeSingle(),
      admin
        .from('workouts')
        .select('id, title, started_at, duration_seconds, tonnage_kg')
        .eq('user_id', user.id)
        .gte('started_at', `${week.start}T00:00:00`)
        .lte('started_at', `${week.end}T23:59:59`)
        .order('started_at', { ascending: true }),
      admin
        .from('runs')
        .select('id, started_at, distance_meters, avg_pace, duration_seconds')
        .eq('user_id', user.id)
        .gte('started_at', `${week.start}T00:00:00`)
        .lte('started_at', `${week.end}T23:59:59`)
        .order('started_at', { ascending: true }),
      admin
        .from('padel_sessions')
        .select('id, started_at, duration_minutes, intensity')
        .eq('user_id', user.id)
        .gte('started_at', `${week.start}T00:00:00`)
        .lte('started_at', `${week.end}T23:59:59`)
        .order('started_at', { ascending: true }),
      admin
        .from('daily_nutrition_summary')
        .select('date, total_calories, total_protein_g, calorie_target, protein_target')
        .eq('user_id', user.id)
        .gte('date', week.start)
        .lte('date', week.end)
        .order('date', { ascending: true }),
      admin
        .from('daily_aggregations')
        .select('date, sleep_hours')
        .eq('user_id', user.id)
        .gte('date', week.start)
        .lte('date', week.end)
        .order('date', { ascending: true }),
      admin
        .from('personal_records')
        .select('exercise_name, value, unit, achieved_at')
        .eq('user_id', user.id)
        .gte('achieved_at', `${week.start}T00:00:00`)
        .lte('achieved_at', `${week.end}T23:59:59`),
      admin
        .from('weekly_reviews')
        .select('week_start, summary_text, completed_at')
        .eq('user_id', user.id)
        .lt('week_start', week.start)
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('user_settings')
        .select('protein_target_per_kg, weekly_training_target')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    // Map workouts
    const workouts: WorkoutSummary[] = (workoutsResult.data ?? []).map((w) => ({
      id: w.id,
      title: w.title ?? 'Workout',
      date: new Date(w.started_at).toISOString().slice(0, 10),
      duration_min: Math.round((w.duration_seconds ?? 0) / 60),
      tonnage_kg: w.tonnage_kg ?? 0,
    }))

    // Map runs
    const runs: RunSummary[] = (runsResult.data ?? []).map((r) => ({
      id: r.id,
      date: new Date(r.started_at).toISOString().slice(0, 10),
      distance_km: Math.round(((r.distance_meters ?? 0) / 1000) * 10) / 10,
      pace: r.avg_pace ?? null,
      duration_min: Math.round((r.duration_seconds ?? 0) / 60),
    }))

    // Map padel
    const padel: PadelSummary[] = (padelResult.data ?? []).map((p) => ({
      id: p.id,
      date: new Date(p.started_at).toISOString().slice(0, 10),
      duration_min: p.duration_minutes ?? 0,
      intensity: p.intensity ?? null,
    }))

    // Nutrition averages
    const nutritionDays = nutritionResult.data ?? []
    const avgCalories = nutritionDays.length > 0
      ? Math.round(nutritionDays.reduce((sum, d) => sum + (d.total_calories ?? 0), 0) / nutritionDays.length)
      : 0
    const avgProtein = nutritionDays.length > 0
      ? Math.round(nutritionDays.reduce((sum, d) => sum + (d.total_protein_g ?? 0), 0) / nutritionDays.length)
      : 0
    const proteinTarget = nutritionDays[0]?.protein_target ?? 140
    const calorieTarget = nutritionDays[0]?.calorie_target ?? 2500

    // Sleep
    const sleepDays = (dailyAggResult.data ?? []).filter((d) => d.sleep_hours != null && d.sleep_hours > 0)
    const avgSleepHours = sleepDays.length > 0
      ? Math.round((sleepDays.reduce((sum, d) => sum + (d.sleep_hours ?? 0), 0) / sleepDays.length) * 10) / 10
      : 0
    const worstSleep = sleepDays.length > 0
      ? sleepDays.reduce((worst, d) => (d.sleep_hours ?? 99) < (worst.sleep_hours ?? 99) ? d : worst)
      : null

    // Highlights (PRs this week)
    const highlights: Highlight[] = (prsResult.data ?? []).map((pr) => ({
      type: 'pr' as const,
      description: `PR: ${pr.exercise_name}`,
      value: `${pr.value}${pr.unit ?? 'kg'}`,
    }))

    // Sessions planned vs completed
    const weeklyAgg = weeklyAggResult.data
    const sessionsPlanned = weeklyAgg?.planned_sessions ?? 0
    const sessionsCompleted = (weeklyAgg?.gym_sessions ?? 0) + (weeklyAgg?.running_sessions ?? 0) + (weeklyAgg?.padel_sessions ?? 0)

    const response: CheckInReviewData = {
      week,
      sessions: { planned: sessionsPlanned, completed: sessionsCompleted },
      workouts,
      runs,
      padel,
      nutrition: { avgCalories, avgProtein, proteinTarget, calorieTarget },
      sleep: {
        avgHours: avgSleepHours,
        worstDay: worstSleep ? { date: worstSleep.date, hours: worstSleep.sleep_hours ?? 0 } : null,
      },
      highlights,
      previousReview: prevReviewResult.data ? {
        week_start: prevReviewResult.data.week_start,
        summary_text: prevReviewResult.data.summary_text,
        completed_at: prevReviewResult.data.completed_at,
      } : null,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Check-in review error:', error)
    return NextResponse.json(
      { error: 'Kan weekdata niet laden', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 2: Create the SWR hook**

```typescript
// src/hooks/useCheckInReview.ts
import useSWR from 'swr'
import type { CheckInReviewData } from '@/app/api/check-in/review/route'

async function fetcher(url: string): Promise<CheckInReviewData> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useCheckInReview(weekStart?: string) {
  const params = weekStart ? `?week_start=${weekStart}` : ''
  const { data, error, isLoading, mutate } = useSWR<CheckInReviewData>(
    `/api/check-in/review${params}`,
    fetcher,
    { revalidateOnFocus: false },
  )

  return {
    data,
    error: error as Error | undefined,
    isLoading,
    refresh: mutate,
  }
}
```

- [ ] **Step 3: Verify the endpoint works**

Run: `pnpm dev` and test with `curl http://localhost:3000/api/check-in/review`
Expected: JSON response with week data (may have empty arrays if no data for current week).

Note: Some table columns (like `tonnage_kg` on workouts, `sleep_hours` on daily_aggregations, `personal_records` table) may not exist or have different names. Check the actual `src/types/database.ts` and adjust column names to match. The query pattern is correct — column names may need updating.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/check-in/review/route.ts src/hooks/useCheckInReview.ts
git commit -m "feat(WC-003): add check-in review API and SWR hook"
```

---

## Task 4: Check-in Analyze API (WC-004)

**Files:**
- Create: `src/lib/ai/prompts/checkin-analyze.ts`
- Create: `src/app/api/check-in/analyze/route.ts`

- [ ] **Step 1: Write the system prompt**

```typescript
// src/lib/ai/prompts/checkin-analyze.ts
import type { CheckInReviewData } from '@/app/api/check-in/review/route'

interface AnalyzePromptParams {
  review: CheckInReviewData
  manualAdditions?: Array<{ type: string; data: Record<string, unknown> }>
  coachingMemory?: Array<{ category: string; key: string; value: string }>
}

export function buildCheckInAnalyzePrompt(params: AnalyzePromptParams): {
  system: string
  userMessage: string
} {
  const { review, manualAdditions, coachingMemory } = params

  const system = `Je bent de Pulse coach — een ervaren, warme en directe personal trainer en voedingscoach.
Je analyseert de trainingsweek van de gebruiker en geeft een persoonlijke samenvatting.

## Regels
- Schrijf in het Nederlands, informeel (je/jij).
- Verwijs naar ECHTE cijfers uit de data. Geen algemeenheden als "je hebt goed getraind".
- De samenvatting is 3-5 zinnen. Concreet, met cijfers, vergelijkingen, en één concrete tip.
- keyInsights zijn 2-4 korte bullet points (max 15 woorden per punt).
- focusNextWeek is één concrete, uitvoerbare tip voor volgende week.

## Output formaat
Antwoord ALLEEN met valid JSON, geen markdown, geen uitleg:
{
  "summary": "string — 3-5 zinnen coaching samenvatting",
  "keyInsights": ["string", "string"],
  "focusNextWeek": "string — één concrete tip"
}`

  // Build user message with actual data
  const workoutLines = review.workouts.length > 0
    ? review.workouts.map((w) => `- ${w.date}: ${w.title} (${w.duration_min}min, ${w.tonnage_kg}kg tonnage)`).join('\n')
    : '- Geen gym sessies deze week'

  const runLines = review.runs.length > 0
    ? review.runs.map((r) => `- ${r.date}: ${r.distance_km}km (${r.duration_min}min${r.pace ? `, pace ${r.pace}` : ''})`).join('\n')
    : '- Geen hardloopsessies'

  const padelLines = review.padel.length > 0
    ? review.padel.map((p) => `- ${p.date}: ${p.duration_min}min${p.intensity ? ` (${p.intensity})` : ''}`).join('\n')
    : '- Geen padel sessies'

  const highlightLines = review.highlights.length > 0
    ? review.highlights.map((h) => `- ${h.description}${h.value ? `: ${h.value}` : ''}`).join('\n')
    : '- Geen PR\'s of milestones'

  const manualLines = manualAdditions && manualAdditions.length > 0
    ? manualAdditions.map((a) => `- ${a.type}: ${JSON.stringify(a.data)}`).join('\n')
    : ''

  const memoryLines = coachingMemory && coachingMemory.length > 0
    ? coachingMemory.map((m) => `- [${m.category}] ${m.key}: ${m.value}`).join('\n')
    : ''

  const userMessage = `## Week ${review.week.number} (${review.week.start} t/m ${review.week.end})

### Sessies
Gepland: ${review.sessions.planned} | Voltooid: ${review.sessions.completed}

### Gym
${workoutLines}

### Hardlopen
${runLines}

### Padel
${padelLines}

### Voeding (weekgemiddelden)
- Calorieën: ${review.nutrition.avgCalories} kcal/dag (target: ${review.nutrition.calorieTarget})
- Eiwit: ${review.nutrition.avgProtein}g/dag (target: ${review.nutrition.proteinTarget}g)

### Slaap
- Gemiddeld: ${review.sleep.avgHours} uur/nacht
${review.sleep.worstDay ? `- Slechtste nacht: ${review.sleep.worstDay.date} (${review.sleep.worstDay.hours}u)` : '- Geen slaapdata beschikbaar'}

### Highlights
${highlightLines}
${manualLines ? `\n### Handmatige toevoegingen\n${manualLines}` : ''}
${memoryLines ? `\n### Context uit eerdere weken\n${memoryLines}` : ''}`

  return { system, userMessage }
}
```

- [ ] **Step 2: Write the analyze API route**

```typescript
// src/app/api/check-in/analyze/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { MODEL } from '@/lib/ai/client'
import { buildCheckInAnalyzePrompt } from '@/lib/ai/prompts/checkin-analyze'
import type { CheckInReviewData } from '@/app/api/check-in/review/route'

const ManualAdditionSchema = z.object({
  type: z.enum(['padel', 'inbody', 'injury', 'note']),
  data: z.record(z.unknown()),
})

const RequestSchema = z.object({
  reviewData: z.custom<CheckInReviewData>(),
  manualAdditions: z.array(ManualAdditionSchema).optional(),
})

export interface AnalyzeResponse {
  summary: string
  keyInsights: string[]
  focusNextWeek: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', code: 'BAD_REQUEST', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    // Fetch coaching memory for context
    const { data: memories } = await admin
      .from('coaching_memory')
      .select('category, key, value')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    const { system, userMessage } = buildCheckInAnalyzePrompt({
      review: parsed.data.reviewData,
      manualAdditions: parsed.data.manualAdditions,
      coachingMemory: memories ?? [],
    })

    const { text } = await generateText({
      model: anthropic(MODEL),
      system,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 1024,
    })

    // Parse JSON response from Claude
    let analysis: AnalyzeResponse
    try {
      // Strip potential markdown code fences
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      analysis = JSON.parse(cleaned)
    } catch {
      console.error('Failed to parse analysis response:', text)
      return NextResponse.json(
        { error: 'Analyse kon niet worden gegenereerd', code: 'AI_PARSE_ERROR' },
        { status: 500 },
      )
    }

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Check-in analyze error:', error)
    return NextResponse.json(
      { error: 'Analyse mislukt', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 3: Verify the endpoint works**

Run: `pnpm dev` and test with a POST request:
```bash
curl -X POST http://localhost:3000/api/check-in/analyze \
  -H "Content-Type: application/json" \
  -d '{"reviewData":{"week":{"start":"2026-03-30","end":"2026-04-05","number":14},"sessions":{"planned":4,"completed":3},"workouts":[],"runs":[],"padel":[],"nutrition":{"avgCalories":2200,"avgProtein":130,"proteinTarget":140,"calorieTarget":2500},"sleep":{"avgHours":7.2,"worstDay":null},"highlights":[],"previousReview":null}}'
```

Expected: JSON with `summary`, `keyInsights`, and `focusNextWeek` fields.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/prompts/checkin-analyze.ts src/app/api/check-in/analyze/route.ts
git commit -m "feat(WC-004): add check-in analyze API with Claude Sonnet coaching"
```

---

## Task 5: Check-in Confirm API (WC-005)

**Files:**
- Create: `src/app/api/check-in/confirm/route.ts`

- [ ] **Step 1: Write the confirm API route**

```typescript
// src/app/api/check-in/confirm/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const HighlightSchema = z.object({
  type: z.string(),
  description: z.string(),
  value: z.string().optional(),
})

const ManualAdditionSchema = z.object({
  type: z.string(),
  data: z.record(z.unknown()),
})

const InBodySchema = z.object({
  weight_kg: z.number().min(30).max(300),
  muscle_mass_kg: z.number().min(10).max(150),
  fat_mass_kg: z.number().min(0).max(150),
  fat_pct: z.number().min(0).max(80),
  waist_cm: z.number().min(40).max(200).optional(),
})

const ConfirmSchema = z.object({
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  week_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  week_number: z.number().int().min(1).max(53),
  summary_text: z.string().min(1),
  key_insights: z.array(z.string()).optional(),
  focus_next_week: z.string().optional(),
  sessions_planned: z.number().int().min(0),
  sessions_completed: z.number().int().min(0),
  highlights: z.array(HighlightSchema).default([]),
  manual_additions: z.array(ManualAdditionSchema).default([]),
  inbody_data: InBodySchema.optional(),
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = ConfirmSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', code: 'BAD_REQUEST', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const input = parsed.data

    // Upsert weekly review (insert or update if exists for this week)
    const { data: review, error: reviewError } = await admin
      .from('weekly_reviews')
      .upsert(
        {
          user_id: user.id,
          week_number: input.week_number,
          week_start: input.week_start,
          week_end: input.week_end,
          summary_text: input.summary_text,
          sessions_planned: input.sessions_planned,
          sessions_completed: input.sessions_completed,
          highlights: input.highlights,
          manual_additions: input.manual_additions,
          inbody_weight_kg: input.inbody_data?.weight_kg ?? null,
          inbody_muscle_mass_kg: input.inbody_data?.muscle_mass_kg ?? null,
          inbody_fat_mass_kg: input.inbody_data?.fat_mass_kg ?? null,
          inbody_fat_pct: input.inbody_data?.fat_pct ?? null,
          inbody_waist_cm: input.inbody_data?.waist_cm ?? null,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,week_start' },
      )
      .select()
      .single()

    if (reviewError) throw reviewError

    // If InBody data provided, also save to body_composition_logs
    if (input.inbody_data) {
      const { error: bodyCompError } = await admin
        .from('body_composition_logs')
        .upsert(
          {
            user_id: user.id,
            date: input.week_end,
            source: 'inbody',
            weight_kg: input.inbody_data.weight_kg,
            muscle_mass_kg: input.inbody_data.muscle_mass_kg,
            fat_mass_kg: input.inbody_data.fat_mass_kg,
            fat_pct: input.inbody_data.fat_pct,
            waist_cm: input.inbody_data.waist_cm ?? null,
          },
          { onConflict: 'user_id,date,source' },
        )

      if (bodyCompError) {
        console.error('Body comp save error (non-fatal):', bodyCompError)
      }
    }

    // Save key insights to coaching_memory (non-blocking)
    if (input.key_insights && input.key_insights.length > 0) {
      admin
        .from('coaching_memory')
        .insert(
          input.key_insights.map((insight) => ({
            user_id: user.id,
            category: 'weekly_review',
            key: `week_${input.week_number}_insight`,
            value: insight,
            source_date: input.week_end,
          })),
        )
        .then(({ error }) => {
          if (error) console.error('Coaching memory save error (non-fatal):', error)
        })
    }

    return NextResponse.json(review, { status: 201 })
  } catch (error) {
    console.error('Check-in confirm error:', error)
    return NextResponse.json(
      { error: 'Opslaan mislukt', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 2: Verify the endpoint works**

Run: `pnpm dev` and test with curl:
```bash
curl -X POST http://localhost:3000/api/check-in/confirm \
  -H "Content-Type: application/json" \
  -d '{"week_start":"2026-03-30","week_end":"2026-04-05","week_number":14,"summary_text":"Test samenvatting","sessions_planned":4,"sessions_completed":3,"highlights":[],"manual_additions":[]}'
```
Expected: 201 with the created review object.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/check-in/confirm/route.ts
git commit -m "feat(WC-005): add check-in confirm API with upsert and coaching memory"
```

---

## Task 6: Body Composition API (WC-006)

**Files:**
- Create: `src/app/api/body-composition/route.ts`
- Create: `src/hooks/useBodyComposition.ts`

- [ ] **Step 1: Write the body composition API route**

```typescript
// src/app/api/body-composition/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const CreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(['inbody', 'manual', 'smart_scale']).default('inbody'),
  weight_kg: z.number().min(30).max(300),
  muscle_mass_kg: z.number().min(10).max(150).optional(),
  fat_mass_kg: z.number().min(0).max(150).optional(),
  fat_pct: z.number().min(0).max(80).optional(),
  bmi: z.number().min(10).max(60).optional(),
  waist_cm: z.number().min(40).max(200).optional(),
  chest_cm: z.number().min(50).max(200).optional(),
  arm_right_cm: z.number().min(15).max(60).optional(),
  thigh_right_cm: z.number().min(30).max(100).optional(),
  notes: z.string().max(500).optional(),
})

export interface BodyCompEntry {
  id: string
  date: string
  source: string
  weight_kg: number | null
  muscle_mass_kg: number | null
  fat_mass_kg: number | null
  fat_pct: number | null
  bmi: number | null
  waist_cm: number | null
  created_at: string
}

export interface BodyCompDelta {
  weight_kg: number | null
  muscle_mass_kg: number | null
  fat_mass_kg: number | null
  fat_pct: number | null
  waist_cm: number | null
}

function computeDelta(
  current: Record<string, number | null | undefined>,
  previous: Record<string, number | null | undefined>,
  keys: string[],
): BodyCompDelta {
  const delta: Record<string, number | null> = {}
  for (const key of keys) {
    const cur = current[key]
    const prev = previous[key]
    delta[key] = cur != null && prev != null
      ? Math.round((cur - prev) * 10) / 10
      : null
  }
  return delta as BodyCompDelta
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '10', 10), 50)

    const admin = createAdminClient()

    const { data, error } = await admin
      .from('body_composition_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(limit)

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error('Body composition GET error:', error)
    return NextResponse.json(
      { error: 'Laden mislukt', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', code: 'BAD_REQUEST', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    // Get previous entry for delta calculation
    const { data: previous } = await admin
      .from('body_composition_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('source', parsed.data.source)
      .lt('date', parsed.data.date)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Upsert new entry
    const { data: entry, error } = await admin
      .from('body_composition_logs')
      .upsert(
        {
          user_id: user.id,
          ...parsed.data,
        },
        { onConflict: 'user_id,date,source' },
      )
      .select()
      .single()

    if (error) throw error

    const deltaKeys = ['weight_kg', 'muscle_mass_kg', 'fat_mass_kg', 'fat_pct', 'waist_cm']
    const delta = previous
      ? computeDelta(parsed.data, previous, deltaKeys)
      : { weight_kg: null, muscle_mass_kg: null, fat_mass_kg: null, fat_pct: null, waist_cm: null }

    return NextResponse.json({ entry, delta, previousDate: previous?.date ?? null }, { status: 201 })
  } catch (error) {
    console.error('Body composition POST error:', error)
    return NextResponse.json(
      { error: 'Opslaan mislukt', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 2: Create the SWR hook**

```typescript
// src/hooks/useBodyComposition.ts
import useSWR from 'swr'
import type { BodyCompEntry } from '@/app/api/body-composition/route'

async function fetcher(url: string): Promise<BodyCompEntry[]> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useBodyComposition(limit = 10) {
  const { data, error, isLoading, mutate } = useSWR<BodyCompEntry[]>(
    `/api/body-composition?limit=${limit}`,
    fetcher,
    { revalidateOnFocus: false },
  )

  return {
    entries: data ?? [],
    error: error as Error | undefined,
    isLoading,
    refresh: mutate,
  }
}
```

- [ ] **Step 3: Verify both endpoints work**

Run: `pnpm dev`
- GET: `curl http://localhost:3000/api/body-composition` → `[]` (empty)
- POST: `curl -X POST http://localhost:3000/api/body-composition -H "Content-Type: application/json" -d '{"date":"2026-04-03","weight_kg":82.5,"muscle_mass_kg":38.2,"fat_mass_kg":14.1,"fat_pct":17.1}'` → entry + null deltas

- [ ] **Step 4: Commit**

```bash
git add src/app/api/body-composition/route.ts src/hooks/useBodyComposition.ts
git commit -m "feat(WC-006): add body composition API with delta calculation"
```

---

## Task 7: Check-in Flow UI (WC-007)

This is the largest task. Build from the inside out: page route → flow container → each card.

**Files:**
- Create: `src/app/check-in/page.tsx`
- Create: `src/components/check-in/CheckInFlow.tsx`
- Create: `src/components/check-in/WeekReviewCard.tsx`
- Create: `src/components/check-in/ManualAddModal.tsx`
- Create: `src/components/check-in/CoachAnalysisCard.tsx`
- Create: `src/components/check-in/ConfirmationCard.tsx`

- [ ] **Step 1: Create the page route**

```typescript
// src/app/check-in/page.tsx
import { CheckInFlow } from '@/components/check-in/CheckInFlow'

export default function CheckInPage() {
  return <CheckInFlow />
}
```

- [ ] **Step 2: Create the main flow container**

This manages the 3-step state and coordinates all child components.

```typescript
// src/components/check-in/CheckInFlow.tsx
'use client'

import { useState } from 'react'
import { useCheckInReview } from '@/hooks/useCheckInReview'
import { WeekReviewCard } from './WeekReviewCard'
import { CoachAnalysisCard } from './CoachAnalysisCard'
import { ConfirmationCard } from './ConfirmationCard'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { SkeletonCard, SkeletonLine } from '@/components/shared/Skeleton'
import { ChevronLeft } from 'lucide-react'
import type { CheckInReviewData } from '@/app/api/check-in/review/route'
import type { AnalyzeResponse } from '@/app/api/check-in/analyze/route'

type Step = 1 | 2 | 3
type ManualAddition = { type: 'padel' | 'inbody' | 'injury' | 'note'; data: Record<string, unknown> }

const STEP_LABELS = ['Review', 'Analyse', 'Bevestig'] as const

export function CheckInFlow() {
  const [step, setStep] = useState<Step>(1)
  const [manualAdditions, setManualAdditions] = useState<ManualAddition[]>([])
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const { data: review, error, isLoading, refresh } = useCheckInReview()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
        <SkeletonCard><SkeletonLine width="w-1/3" /><SkeletonLine width="w-full" height="h-32" /></SkeletonCard>
      </div>
    )
  }

  if (error || !review) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <ErrorAlert message="Kan weekdata niet laden." onRetry={refresh} />
      </div>
    )
  }

  function handleAddManual(addition: ManualAddition) {
    setManualAdditions((prev) => [...prev, addition])
  }

  function handleRemoveManual(index: number) {
    setManualAdditions((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleAnalyze() {
    setStep(2)
  }

  function handleAnalysisComplete(result: AnalyzeResponse) {
    setAnalysis(result)
  }

  function handleConfirmed() {
    setConfirmed(true)
  }

  function handleBack() {
    if (step > 1) setStep((s) => (s - 1) as Step)
  }

  if (confirmed) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 max-w-lg mx-auto min-h-[60vh]">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-green-light">
          <svg className="h-8 w-8 text-status-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-section-title text-text-primary">Week {review.week.number} afgesloten!</h2>
        <p className="text-body text-text-secondary text-center">
          Je check-in is opgeslagen. Goed gedaan deze week.
        </p>
        <a
          href="/"
          className="mt-4 rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-accent-text"
        >
          Terug naar home
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        {step > 1 && (
          <button
            onClick={handleBack}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-subtle text-text-tertiary hover:bg-bg-hover"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <div>
          <h1 className="text-page-title text-text-primary">Week {review.week.number}</h1>
          <p className="text-caption text-text-tertiary uppercase tracking-wide">
            {review.week.start} — {review.week.end}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEP_LABELS.map((label, i) => {
          const stepNum = (i + 1) as Step
          const isActive = stepNum === step
          const isDone = stepNum < step
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <div className={`h-px w-6 ${isDone ? 'bg-status-green' : 'bg-border-light'}`} />}
              <span className={`text-caption font-medium ${
                isActive ? 'text-text-primary' : isDone ? 'text-status-green' : 'text-text-tertiary'
              }`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Step content */}
      {step === 1 && (
        <WeekReviewCard
          review={review}
          manualAdditions={manualAdditions}
          onAddManual={handleAddManual}
          onRemoveManual={handleRemoveManual}
          onNext={handleAnalyze}
        />
      )}

      {step === 2 && (
        <CoachAnalysisCard
          review={review}
          manualAdditions={manualAdditions}
          analysis={analysis}
          onAnalysisComplete={handleAnalysisComplete}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && analysis && (
        <ConfirmationCard
          review={review}
          analysis={analysis}
          manualAdditions={manualAdditions}
          onConfirmed={handleConfirmed}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create WeekReviewCard**

```typescript
// src/components/check-in/WeekReviewCard.tsx
'use client'

import { useState } from 'react'
import { Dumbbell, Footprints, Trophy, Moon, Utensils, Plus } from 'lucide-react'
import { ManualAddModal } from './ManualAddModal'
import type { CheckInReviewData } from '@/app/api/check-in/review/route'

interface WeekReviewCardProps {
  review: CheckInReviewData
  manualAdditions: Array<{ type: string; data: Record<string, unknown> }>
  onAddManual: (addition: { type: 'padel' | 'inbody' | 'injury' | 'note'; data: Record<string, unknown> }) => void
  onRemoveManual: (index: number) => void
  onNext: () => void
}

export function WeekReviewCard({ review, manualAdditions, onAddManual, onRemoveManual, onNext }: WeekReviewCardProps) {
  const [showAddModal, setShowAddModal] = useState(false)

  return (
    <>
      {/* Sessions overview */}
      <div className="rounded-2xl bg-bg-card border border-border-light p-5">
        <h3 className="text-card-title text-text-primary mb-3">Sessies</h3>
        <div className="flex items-baseline gap-1">
          <span className="text-stat text-text-primary">{review.sessions.completed}</span>
          <span className="text-body text-text-tertiary">/ {review.sessions.planned} gepland</span>
        </div>

        {/* Workout list */}
        {review.workouts.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {review.workouts.map((w) => (
              <div key={w.id} className="flex items-center gap-3 text-sm">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sport-gym-light">
                  <Dumbbell size={14} className="text-sport-gym" />
                </div>
                <div className="flex-1">
                  <span className="text-text-primary font-medium">{w.title}</span>
                  <span className="text-text-tertiary ml-2">{w.duration_min}min</span>
                </div>
                <span className="text-caption text-text-tertiary">{w.date}</span>
              </div>
            ))}
          </div>
        )}

        {/* Runs */}
        {review.runs.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {review.runs.map((r) => (
              <div key={r.id} className="flex items-center gap-3 text-sm">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sport-run-light">
                  <Footprints size={14} className="text-sport-run" />
                </div>
                <div className="flex-1">
                  <span className="text-text-primary font-medium">{r.distance_km}km</span>
                  <span className="text-text-tertiary ml-2">{r.duration_min}min</span>
                </div>
                <span className="text-caption text-text-tertiary">{r.date}</span>
              </div>
            ))}
          </div>
        )}

        {/* Padel */}
        {review.padel.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {review.padel.map((p) => (
              <div key={p.id} className="flex items-center gap-3 text-sm">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sport-padel-light">
                  <span className="text-xs">🎾</span>
                </div>
                <div className="flex-1">
                  <span className="text-text-primary font-medium">Padel</span>
                  <span className="text-text-tertiary ml-2">{p.duration_min}min</span>
                </div>
                <span className="text-caption text-text-tertiary">{p.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nutrition */}
      <div className="rounded-2xl bg-bg-card border border-border-light p-5">
        <div className="flex items-center gap-2 mb-3">
          <Utensils size={16} className="text-text-tertiary" />
          <h3 className="text-card-title text-text-primary">Voeding</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-caption text-text-tertiary">Calorieën/dag</p>
            <p className="text-stat text-text-primary">{review.nutrition.avgCalories}</p>
            <p className="text-caption text-text-tertiary">target {review.nutrition.calorieTarget}</p>
          </div>
          <div>
            <p className="text-caption text-text-tertiary">Eiwit/dag</p>
            <p className="text-stat text-text-primary">{review.nutrition.avgProtein}g</p>
            <p className="text-caption text-text-tertiary">target {review.nutrition.proteinTarget}g</p>
          </div>
        </div>
      </div>

      {/* Sleep */}
      <div className="rounded-2xl bg-bg-card border border-border-light p-5">
        <div className="flex items-center gap-2 mb-3">
          <Moon size={16} className="text-text-tertiary" />
          <h3 className="text-card-title text-text-primary">Slaap</h3>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-stat text-text-primary">{review.sleep.avgHours}</span>
          <span className="text-body text-text-tertiary">uur gemiddeld</span>
        </div>
        {review.sleep.worstDay && (
          <p className="text-caption text-text-tertiary mt-1">
            Slechtste nacht: {review.sleep.worstDay.date} ({review.sleep.worstDay.hours}u)
          </p>
        )}
      </div>

      {/* Highlights */}
      {review.highlights.length > 0 && (
        <div className="rounded-2xl bg-bg-card border border-border-light p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-status-amber" />
            <h3 className="text-card-title text-text-primary">Highlights</h3>
          </div>
          <div className="flex flex-col gap-2">
            {review.highlights.map((h, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-text-primary">{h.description}</span>
                {h.value && <span className="text-status-green font-medium">{h.value}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual additions */}
      {manualAdditions.length > 0 && (
        <div className="rounded-2xl bg-bg-card border border-border-light p-5">
          <h3 className="text-card-title text-text-primary mb-3">Handmatig toegevoegd</h3>
          <div className="flex flex-col gap-2">
            {manualAdditions.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-text-primary capitalize">{a.type}</span>
                <button
                  onClick={() => onRemoveManual(i)}
                  className="text-caption text-status-red hover:underline"
                >
                  Verwijder
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-xl border border-border-light bg-bg-card px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-hover"
        >
          <Plus size={16} />
          Toevoegen
        </button>
        <button
          onClick={onNext}
          className="flex-1 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-text"
        >
          Analyse genereren
        </button>
      </div>

      {showAddModal && (
        <ManualAddModal
          onAdd={onAddManual}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 4: Create ManualAddModal**

```typescript
// src/components/check-in/ManualAddModal.tsx
'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface ManualAddModalProps {
  onAdd: (addition: { type: 'padel' | 'inbody' | 'injury' | 'note'; data: Record<string, unknown> }) => void
  onClose: () => void
}

type AddType = 'padel' | 'inbody' | 'injury' | 'note'

export function ManualAddModal({ onAdd, onClose }: ManualAddModalProps) {
  const [selectedType, setSelectedType] = useState<AddType | null>(null)

  // Padel state
  const [padelDuration, setPadelDuration] = useState('60')
  const [padelIntensity, setPadelIntensity] = useState<'light' | 'moderate' | 'intense'>('moderate')

  // InBody state
  const [inbodyWeight, setInbodyWeight] = useState('')
  const [inbodyMuscle, setInbodyMuscle] = useState('')
  const [inbodyFat, setInbodyFat] = useState('')
  const [inbodyFatPct, setInbodyFatPct] = useState('')
  const [inbodyWaist, setInbodyWaist] = useState('')

  // Note state
  const [noteText, setNoteText] = useState('')

  function handleSubmit() {
    if (selectedType === 'padel') {
      onAdd({
        type: 'padel',
        data: { duration_min: parseInt(padelDuration, 10), intensity: padelIntensity },
      })
    } else if (selectedType === 'inbody') {
      onAdd({
        type: 'inbody',
        data: {
          weight_kg: parseFloat(inbodyWeight) || undefined,
          muscle_mass_kg: parseFloat(inbodyMuscle) || undefined,
          fat_mass_kg: parseFloat(inbodyFat) || undefined,
          fat_pct: parseFloat(inbodyFatPct) || undefined,
          waist_cm: parseFloat(inbodyWaist) || undefined,
        },
      })
    } else if (selectedType === 'note') {
      if (noteText.trim()) {
        onAdd({ type: 'note', data: { text: noteText.trim() } })
      }
    }
    onClose()
  }

  const inputClass = 'w-full rounded-lg border border-border-light bg-bg-page px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong'
  const labelClass = 'text-caption text-text-secondary font-medium'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-bg-card shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-base font-semibold text-text-primary">
            {selectedType ? 'Toevoegen' : 'Wat wil je toevoegen?'}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-subtle text-text-tertiary hover:bg-bg-hover"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pb-5">
          {!selectedType ? (
            /* Type selection */
            <div className="flex flex-col gap-2">
              {([
                { type: 'padel' as const, label: 'Padel sessie', icon: '🎾' },
                { type: 'inbody' as const, label: 'InBody scan', icon: '📊' },
                { type: 'note' as const, label: 'Notitie', icon: '📝' },
              ]).map(({ type, label, icon }) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className="flex items-center gap-3 rounded-xl border border-border-light p-4 text-left hover:bg-bg-hover"
                >
                  <span className="text-lg">{icon}</span>
                  <span className="text-sm font-medium text-text-primary">{label}</span>
                </button>
              ))}
            </div>
          ) : selectedType === 'padel' ? (
            /* Padel form */
            <div className="flex flex-col gap-4">
              <div>
                <label className={labelClass}>Duur (minuten)</label>
                <input
                  type="number"
                  value={padelDuration}
                  onChange={(e) => setPadelDuration(e.target.value)}
                  className={inputClass}
                  min={15}
                  max={180}
                />
              </div>
              <div>
                <label className={labelClass}>Intensiteit</label>
                <div className="flex gap-2 mt-1">
                  {(['light', 'moderate', 'intense'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setPadelIntensity(level)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                        padelIntensity === level
                          ? 'border-accent bg-accent text-accent-text'
                          : 'border-border-light text-text-secondary hover:bg-bg-hover'
                      }`}
                    >
                      {level === 'light' ? 'Licht' : level === 'moderate' ? 'Normaal' : 'Zwaar'}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleSubmit}
                className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-text"
              >
                Toevoegen
              </button>
            </div>
          ) : selectedType === 'inbody' ? (
            /* InBody form */
            <div className="flex flex-col gap-3">
              <div>
                <label className={labelClass}>Gewicht (kg)</label>
                <input type="number" step="0.1" value={inbodyWeight} onChange={(e) => setInbodyWeight(e.target.value)} className={inputClass} placeholder="82.5" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Spiermassa (kg)</label>
                  <input type="number" step="0.1" value={inbodyMuscle} onChange={(e) => setInbodyMuscle(e.target.value)} className={inputClass} placeholder="38.2" />
                </div>
                <div>
                  <label className={labelClass}>Vetmassa (kg)</label>
                  <input type="number" step="0.1" value={inbodyFat} onChange={(e) => setInbodyFat(e.target.value)} className={inputClass} placeholder="14.1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Vetpercentage (%)</label>
                  <input type="number" step="0.1" value={inbodyFatPct} onChange={(e) => setInbodyFatPct(e.target.value)} className={inputClass} placeholder="17.1" />
                </div>
                <div>
                  <label className={labelClass}>Buikomtrek (cm)</label>
                  <input type="number" step="0.1" value={inbodyWaist} onChange={(e) => setInbodyWaist(e.target.value)} className={inputClass} placeholder="84.0" />
                </div>
              </div>
              <button
                onClick={handleSubmit}
                disabled={!inbodyWeight}
                className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-text disabled:opacity-50"
              >
                Toevoegen
              </button>
            </div>
          ) : (
            /* Note form */
            <div className="flex flex-col gap-3">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className={`${inputClass} min-h-[100px] resize-none`}
                placeholder="Bijv. 'Deze week veel stress op werk gehad' of 'Linkerknie voelt stijf'"
              />
              <button
                onClick={handleSubmit}
                disabled={!noteText.trim()}
                className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-text disabled:opacity-50"
              >
                Toevoegen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create CoachAnalysisCard**

```typescript
// src/components/check-in/CoachAnalysisCard.tsx
'use client'

import { useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import type { CheckInReviewData } from '@/app/api/check-in/review/route'
import type { AnalyzeResponse } from '@/app/api/check-in/analyze/route'

interface CoachAnalysisCardProps {
  review: CheckInReviewData
  manualAdditions: Array<{ type: string; data: Record<string, unknown> }>
  analysis: AnalyzeResponse | null
  onAnalysisComplete: (result: AnalyzeResponse) => void
  onNext: () => void
}

export function CoachAnalysisCard({
  review,
  manualAdditions,
  analysis,
  onAnalysisComplete,
  onNext,
}: CoachAnalysisCardProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  useEffect(() => {
    if (analysis) return // Already have analysis
    if (status !== 'idle') return

    async function fetchAnalysis() {
      setStatus('loading')
      try {
        const res = await fetch('/api/check-in/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewData: review, manualAdditions }),
        })
        if (!res.ok) throw new Error('Analyse mislukt')
        const data: AnalyzeResponse = await res.json()
        onAnalysisComplete(data)
      } catch {
        setStatus('error')
      }
    }

    fetchAnalysis()
  }, [analysis, status, review, manualAdditions, onAnalysisComplete])

  if (status === 'loading' && !analysis) {
    return (
      <div className="rounded-2xl bg-bg-card border border-border-light p-8 flex flex-col items-center gap-4">
        <Loader2 size={32} className="animate-spin text-text-tertiary" />
        <div className="text-center">
          <p className="text-card-title text-text-primary">Coach analyseert je week...</p>
          <p className="text-caption text-text-tertiary mt-1">Dit duurt een paar seconden</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <ErrorAlert
        message="De analyse kon niet worden gegenereerd. Probeer opnieuw."
        onRetry={() => setStatus('idle')}
      />
    )
  }

  if (!analysis) return null

  return (
    <>
      <div className="rounded-2xl bg-bg-card border border-border-light p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={18} className="text-status-amber" />
          <h3 className="text-card-title text-text-primary">Coach Analyse</h3>
        </div>

        <p className="text-body text-text-primary leading-relaxed">{analysis.summary}</p>

        {analysis.keyInsights.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {analysis.keyInsights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-text-tertiary mt-0.5">•</span>
                <span className="text-text-secondary">{insight}</span>
              </div>
            ))}
          </div>
        )}

        {analysis.focusNextWeek && (
          <div className="mt-4 rounded-xl bg-sport-gym-light border border-sport-gym/20 p-4">
            <p className="text-caption text-sport-gym-dark font-medium mb-1">Focus volgende week</p>
            <p className="text-sm text-text-primary">{analysis.focusNextWeek}</p>
          </div>
        )}
      </div>

      <button
        onClick={onNext}
        className="w-full rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-text"
      >
        Bevestigen en opslaan
      </button>
    </>
  )
}
```

- [ ] **Step 6: Create ConfirmationCard**

```typescript
// src/components/check-in/ConfirmationCard.tsx
'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import type { CheckInReviewData } from '@/app/api/check-in/review/route'
import type { AnalyzeResponse } from '@/app/api/check-in/analyze/route'

interface ConfirmationCardProps {
  review: CheckInReviewData
  analysis: AnalyzeResponse
  manualAdditions: Array<{ type: string; data: Record<string, unknown> }>
  onConfirmed: () => void
}

export function ConfirmationCard({
  review,
  analysis,
  manualAdditions,
  onConfirmed,
}: ConfirmationCardProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  async function handleConfirm() {
    setStatus('loading')

    // Extract InBody data from manual additions if present
    const inbodyAddition = manualAdditions.find((a) => a.type === 'inbody')
    const inbodyData = inbodyAddition
      ? {
          weight_kg: inbodyAddition.data.weight_kg as number,
          muscle_mass_kg: inbodyAddition.data.muscle_mass_kg as number,
          fat_mass_kg: inbodyAddition.data.fat_mass_kg as number,
          fat_pct: inbodyAddition.data.fat_pct as number,
          waist_cm: inbodyAddition.data.waist_cm as number | undefined,
        }
      : undefined

    try {
      const res = await fetch('/api/check-in/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_start: review.week.start,
          week_end: review.week.end,
          week_number: review.week.number,
          summary_text: analysis.summary,
          key_insights: analysis.keyInsights,
          focus_next_week: analysis.focusNextWeek,
          sessions_planned: review.sessions.planned,
          sessions_completed: review.sessions.completed,
          highlights: review.highlights,
          manual_additions: manualAdditions,
          inbody_data: inbodyData,
        }),
      })

      if (!res.ok) throw new Error('Opslaan mislukt')
      onConfirmed()
    } catch {
      setStatus('error')
    }
  }

  return (
    <>
      {/* Summary card */}
      <div className="rounded-2xl bg-bg-card border border-border-light p-5">
        <h3 className="text-card-title text-text-primary mb-4">Samenvatting</h3>

        <div className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-text-secondary">Sessies</span>
            <span className="text-text-primary font-medium">
              {review.sessions.completed}/{review.sessions.planned}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Gym</span>
            <span className="text-text-primary">{review.workouts.length} sessies</span>
          </div>
          {review.runs.length > 0 && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Hardlopen</span>
              <span className="text-text-primary">{review.runs.length} sessies</span>
            </div>
          )}
          {review.padel.length > 0 && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Padel</span>
              <span className="text-text-primary">{review.padel.length} sessies</span>
            </div>
          )}
          <div className="h-px bg-border-light" />
          <div className="flex justify-between">
            <span className="text-text-secondary">Eiwit gem.</span>
            <span className="text-text-primary">{review.nutrition.avgProtein}g/dag</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Slaap gem.</span>
            <span className="text-text-primary">{review.sleep.avgHours}u/nacht</span>
          </div>
          {manualAdditions.length > 0 && (
            <>
              <div className="h-px bg-border-light" />
              <div className="flex justify-between">
                <span className="text-text-secondary">Handmatig</span>
                <span className="text-text-primary">{manualAdditions.length} toevoegingen</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Coach quote */}
      <div className="rounded-2xl bg-sport-gym-light border border-sport-gym/20 p-4">
        <p className="text-sm text-text-primary italic">"{analysis.summary}"</p>
      </div>

      {status === 'error' && (
        <ErrorAlert
          message="Opslaan mislukt. Probeer opnieuw."
          onRetry={() => setStatus('idle')}
        />
      )}

      {/* Confirm button */}
      <button
        onClick={handleConfirm}
        disabled={status === 'loading'}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-medium text-accent-text disabled:opacity-50"
      >
        {status === 'loading' ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <CheckCircle2 size={16} />
        )}
        Week {review.week.number} afsluiten
      </button>
    </>
  )
}
```

- [ ] **Step 7: Verify the full flow works**

Run: `pnpm dev` and navigate to `http://localhost:3000/check-in`

Expected flow:
1. Review card loads with week data
2. "Analyse genereren" triggers AI call, shows loading spinner
3. Coach analysis appears with summary, insights, focus tip
4. "Bevestigen en opslaan" saves to DB
5. Success screen with "Terug naar home" link

Check for TypeScript errors: `pnpm tsc --noEmit`

- [ ] **Step 8: Commit**

```bash
git add src/app/check-in/page.tsx src/components/check-in/
git commit -m "feat(WC-007): add check-in flow UI with 3-step guided review"
```

---

## Task 8: Homescreen Badge (WC-008)

**Files:**
- Create: `src/components/home/CheckInBadge.tsx`
- Modify: `src/components/dashboard/DashboardPage.tsx`

- [ ] **Step 1: Create the badge component**

```typescript
// src/components/home/CheckInBadge.tsx
'use client'

import useSWR from 'swr'
import { ClipboardCheck } from 'lucide-react'
import Link from 'next/link'

async function fetcher(url: string) {
  const res = await fetch(url)
  if (!res.ok) return null
  return res.json()
}

function getWeekNumber(): number {
  const now = new Date()
  const jan4 = new Date(now.getFullYear(), 0, 4)
  const day = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1)
  const dayOfYear = Math.floor((monday.getTime() - jan4.getTime()) / 86400000) + 4
  return Math.ceil(dayOfYear / 7)
}

function isCheckInWindow(): boolean {
  const day = new Date().getDay()
  return day === 0 || day === 1 || day === 6 // zo, ma, za
}

export function CheckInBadge() {
  // Only render during check-in window (sa/zo/ma)
  if (!isCheckInWindow()) return null

  // Get current week's Monday
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)
  const weekStart = monday.toISOString().slice(0, 10)

  const { data: review } = useSWR(
    `/api/check-in/review?week_start=${weekStart}`,
    fetcher,
    { revalidateOnFocus: false },
  )

  // Check if a review already exists for this week by trying to fetch it
  const { data: existingReview } = useSWR(
    `/api/check-in/confirm/status?week_start=${weekStart}`,
    async (url: string) => {
      // We'll check if weekly_reviews has an entry for this week
      // For now, we piggyback on the review endpoint's previousReview field
      // If the review data shows this week has been reviewed, hide the badge
      return null
    },
    { revalidateOnFocus: false },
  )

  // Simple approach: check if the review endpoint shows a completed review
  // This will be replaced with a proper check once we have the confirm status endpoint
  const weekNumber = getWeekNumber()

  return (
    <Link
      href="/check-in"
      className="flex items-center gap-3 rounded-2xl bg-sport-gym-light border border-sport-gym/20 p-4 hover:bg-sport-gym-light/80 transition-colors"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sport-gym/10">
        <ClipboardCheck size={20} className="text-sport-gym" />
      </div>
      <div className="flex-1">
        <p className="text-card-title text-text-primary">Week {weekNumber} afsluiten</p>
        <p className="text-caption text-text-tertiary">Bekijk je voortgang en sluit af met de coach</p>
      </div>
    </Link>
  )
}
```

Note: The badge visibility logic is simplified for v1. A proper implementation would check `weekly_reviews` for the current week. The subagent should refine this — either add a lightweight `/api/check-in/status` endpoint or query the review endpoint's data to determine if this week is already reviewed.

- [ ] **Step 2: Add the badge to DashboardPage**

Read `src/components/dashboard/DashboardPage.tsx` and add the `CheckInBadge` import and component. Place it near the top of the return JSX, above `WeekAtAGlance`:

```typescript
import { CheckInBadge } from '@/components/home/CheckInBadge'

// In the return JSX, add before the first card:
<CheckInBadge />
```

- [ ] **Step 3: Verify the badge renders**

Run: `pnpm dev` and check the homepage.
- On sa/zo/ma: badge should appear with "Week X afsluiten" text and link to `/check-in`
- On other days: badge should not appear
- After completing a check-in: badge should hide (verify after full flow works)

- [ ] **Step 4: Commit**

```bash
git add src/components/home/CheckInBadge.tsx src/components/dashboard/DashboardPage.tsx
git commit -m "feat(WC-008): add check-in badge to homescreen on weekends"
```

---

## Task 9: Update plan and final verification

**Files:**
- Modify: `PLAN-WEEKLY-CHECKIN.md`

- [ ] **Step 1: Verify all routes work end-to-end**

Run these checks:
```bash
pnpm tsc --noEmit                    # No TypeScript errors
pnpm dev                             # Dev server starts
```

Navigate through the full flow manually:
1. Homepage → badge visible (if weekend)
2. Click badge → `/check-in` loads
3. Step 1: Review data appears
4. Add manual padel session
5. Click "Analyse genereren" → AI analysis loads
6. Click "Bevestigen en opslaan" → success screen
7. Return to homepage → badge hidden

- [ ] **Step 2: Update plan checkboxes**

Mark all completed stories as `[x]` in `PLAN-WEEKLY-CHECKIN.md`.

- [ ] **Step 3: Commit**

```bash
git add PLAN-WEEKLY-CHECKIN.md
git commit -m "docs: update weekly check-in plan — v1 complete"
```
