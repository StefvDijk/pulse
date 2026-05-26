# Coach Fase 2 — Belief-laag, Active Inquiry, Unified Inbox

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Geef de coach een actief wereldmodel (`coach_beliefs`), de mogelijkheid om Stef gerichte vragen te stellen (`ask_stef` → `coach_questions`), en een centrale plek waar alle proactieve berichten en open vragen samenkomen (`coach_inbox` + UI).

**Architecture:** Drie nieuwe tabellen (`coach_beliefs`, `coach_questions`, `coach_inbox`) zitten naast de bestaande `coaching_memory`. Een nieuwe `belief-extractor` (Haiku, fire-and-forget) draait na chat-turns, na Hevy-sync, en na Apple Health ingest om hypotheses te genereren of evidence toe te voegen. Een pure `belief-update`-functie herrekent confidence. Een wekelijkse safety-net cron sweept beliefs die niet door een event geraakt zijn. De coach krijgt zijn beliefs mee in `buildMemoryReadBlock` (verlengt fase-1 read-blok) en kan via `ask_stef` een rij naar `coach_questions` schrijven + een card naar `coach_inbox`. Een unified inbox-UI toont alle items in prioriteitsvolgorde; een aparte belief-review-pagina laat Stef hypotheses confirmen/afwijzen.

**Tech Stack:** Supabase (Postgres + RLS) · Next.js 14 App Router · Vercel AI SDK v6 · `@ai-sdk/anthropic` · `claude-haiku-4-5` voor extractor · Tailwind + bestaande design-tokens · vitest voor tests.

---

## File structure

**New files:**
- `supabase/migrations/20260526000001_coach_beliefs.sql` — tabel + indexes + RLS
- `supabase/migrations/20260526000002_coach_questions.sql` — tabel + indexes + RLS
- `supabase/migrations/20260526000003_coach_inbox.sql` — tabel + indexes + RLS
- `src/lib/ai/belief-update.ts` — pure function: belief + evidence → herrekende confidence/status
- `src/lib/ai/belief-extractor.ts` — Haiku-extractor (proposes/updates beliefs from a scoped event)
- `src/lib/coach/inbox.ts` — helper: enqueue item into `coach_inbox`
- `src/lib/ai/tools/handlers/ask-stef.ts` — handler voor `ask_stef`
- `src/app/api/cron/belief-sweep/route.ts` — wekelijkse safety-net
- `src/app/api/coach-inbox/route.ts` — GET list + PATCH bulk status
- `src/app/api/coach-inbox/[id]/route.ts` — PATCH single (read/dismiss/actioned)
- `src/app/api/coach-questions/[id]/answer/route.ts` — POST answer
- `src/app/api/coach-beliefs/route.ts` — GET list (active + confirmed)
- `src/app/api/coach-beliefs/[id]/route.ts` — PATCH (confirm/reject)
- `src/components/coach/InboxBell.tsx` — bell-icon met counter
- `src/components/coach/InboxList.tsx` — dropdown/list view
- `src/components/coach/InboxCard.tsx` — single card rendering per type
- `src/app/coach/beliefs/page.tsx` — belief-review pagina
- `tests/lib/ai/belief-update.test.ts`
- `tests/lib/ai/belief-extractor.test.ts`
- `tests/lib/coach/inbox.test.ts`

**Modified files:**
- `src/lib/ai/coach-core.ts` — `buildMemoryReadBlock` voegt beliefs toe
- `src/lib/ai/tools/definitions.ts` — register `ask_stef`
- `src/app/api/chat/route.ts` — fire-and-forget belief-extractor na assistant-turn
- `src/lib/hevy/sync.ts` — fire-and-forget belief-extractor na succesvolle sync (training)
- `src/app/api/ingest/apple-health/route.ts` — fire-and-forget belief-extractor na ingest (recovery)
- `vercel.json` — voeg cron `belief-sweep` toe (zondag 22:00)
- `src/components/home/Header.tsx` (of equivalent) — mount `InboxBell`
- `tests/lib/ai/coach-core.test.ts` — beliefs-blok in mock
- `src/types/database.ts` — wordt geregenereerd na elke migratie (`supabase gen types typescript --local > src/types/database.ts`)

---

## Conventions used in this plan

- Migration filenames: `YYYYMMDDHHMMSS_name.sql` met `20260526000001..3` voor vandaag (volgt repo-conventie).
- Cron auth: header `Authorization: Bearer ${CRON_SECRET}`. 401 anders.
- Extractors: gebruik `MEMORY_MODEL` (Haiku) via `createJsonCompletion`, fire-and-forget pattern (errors loggen, niet throwen).
- Tests: vitest, `vi.mock('@/lib/supabase/admin', …)`, located in `tests/lib/...`.
- Commits: conventional, korte body indien zinvol. Eén commit per task (steps 1-N + final commit step).

---

### Task 1: Migration `coach_beliefs` + RLS + types

**Files:**
- Create: `supabase/migrations/20260526000001_coach_beliefs.sql`
- Regen: `src/types/database.ts`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260526000001_coach_beliefs.sql`:

```sql
-- Migration: coach_beliefs — procedural memory layer
-- Stores hypotheses the coach holds about Stef (what works, what doesn't).
-- Confidence is recalculated by belief-update.ts from evidence arrays.

CREATE TABLE coach_beliefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    hypothesis_text TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('training', 'nutrition', 'recovery', 'lifestyle', 'preference')),
    evidence_for JSONB NOT NULL DEFAULT '[]'::jsonb,
    evidence_against JSONB NOT NULL DEFAULT '[]'::jsonb,
    confidence NUMERIC(3, 2) NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'confirmed', 'superseded', 'rejected')),
    superseded_by UUID REFERENCES coach_beliefs(id) ON DELETE SET NULL,
    last_tested_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_coach_beliefs_user ON coach_beliefs(user_id, status);
CREATE INDEX idx_coach_beliefs_category ON coach_beliefs(user_id, category) WHERE status = 'active';
CREATE INDEX idx_coach_beliefs_last_tested ON coach_beliefs(last_tested_at) WHERE status = 'active';

CREATE TRIGGER coach_beliefs_updated_at
    BEFORE UPDATE ON coach_beliefs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE coach_beliefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY coach_beliefs_select_own ON coach_beliefs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY coach_beliefs_modify_own ON coach_beliefs
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY coach_beliefs_service_role ON coach_beliefs
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Apply migration locally**

Run: `supabase db push`
Expected: prints `Applying migration 20260526000001_coach_beliefs.sql` and exits 0.

- [ ] **Step 3: Regenerate types**

Run: `supabase gen types typescript --local > src/types/database.ts`
Expected: `database.ts` updated, `coach_beliefs` row present.

- [ ] **Step 4: Verify table exists**

Run: `supabase db dump --data-only --table coach_beliefs 2>&1 | head -5`
Expected: outputs `COPY public.coach_beliefs (…) FROM stdin;` with no data rows.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260526000001_coach_beliefs.sql src/types/database.ts
git commit -m "feat(coach): add coach_beliefs table for procedural memory layer"
```

---

### Task 2: Pure function `belief-update.ts`

**Files:**
- Create: `src/lib/ai/belief-update.ts`
- Test: `tests/lib/ai/belief-update.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/ai/belief-update.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { recomputeBelief, type BeliefInput, type EvidenceItem } from '@/lib/ai/belief-update'

const ev = (kind: 'for' | 'against', daysAgo: number, observation = 'obs'): EvidenceItem => ({
  date: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
  observation,
  source: 'test',
  kind,
})

describe('recomputeBelief', () => {
  it('starts neutral when no evidence', () => {
    const out = recomputeBelief({ evidence_for: [], evidence_against: [], status: 'active' })
    expect(out.confidence).toBeCloseTo(0.5, 2)
    expect(out.status).toBe('active')
  })

  it('weights for-evidence above 0.5 when only positive', () => {
    const input: BeliefInput = {
      evidence_for: [ev('for', 1), ev('for', 2), ev('for', 3)],
      evidence_against: [],
      status: 'active',
    }
    const out = recomputeBelief(input)
    expect(out.confidence).toBeGreaterThan(0.7)
  })

  it('flips below 0.5 when only against', () => {
    const out = recomputeBelief({
      evidence_for: [],
      evidence_against: [ev('against', 1), ev('against', 2)],
      status: 'active',
    })
    expect(out.confidence).toBeLessThan(0.3)
  })

  it('decays older evidence (5x weight at 0d vs 60d)', () => {
    const recent = recomputeBelief({
      evidence_for: [ev('for', 0)],
      evidence_against: [ev('against', 60)],
      status: 'active',
    })
    expect(recent.confidence).toBeGreaterThan(0.7)
  })

  it('promotes to confirmed at >= 0.85 with at least 4 datapoints', () => {
    const out = recomputeBelief({
      evidence_for: [ev('for', 1), ev('for', 2), ev('for', 3), ev('for', 4), ev('for', 5)],
      evidence_against: [],
      status: 'active',
    })
    expect(out.confidence).toBeGreaterThanOrEqual(0.85)
    expect(out.status).toBe('confirmed')
  })

  it('marks superseded at < 0.20', () => {
    const out = recomputeBelief({
      evidence_for: [],
      evidence_against: [ev('against', 1), ev('against', 1), ev('against', 1), ev('against', 1), ev('against', 1)],
      status: 'active',
    })
    expect(out.confidence).toBeLessThan(0.2)
    expect(out.status).toBe('superseded')
  })

  it('confirmed beliefs stay confirmed even if new evidence dips', () => {
    const out = recomputeBelief({
      evidence_for: [ev('for', 1)],
      evidence_against: [ev('against', 1)],
      status: 'confirmed',
    })
    expect(out.status).toBe('confirmed')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/lib/ai/belief-update.test.ts`
Expected: all 7 tests fail with `Failed to resolve import "@/lib/ai/belief-update"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/ai/belief-update.ts`:

```typescript
// ---------------------------------------------------------------------------
// belief-update — pure confidence-recalc for coach_beliefs.
//
// Algoritme: weighted count-based with linear decay.
// - Elke evidence krijgt gewicht w = max(0.2, 1 - daysOld/60).
// - confidence = sum(w_for) / (sum(w_for) + sum(w_against)).
// - Geen evidence → 0.5 (neutraal).
// - confidence >= 0.85 EN (n_for + n_against) >= 4 → status confirmed.
// - confidence < 0.20 → status superseded.
// - status confirmed/rejected wijzigt niet meer automatisch.
// ---------------------------------------------------------------------------

export interface EvidenceItem {
  date: string // ISO timestamp
  observation: string
  source: string
  kind: 'for' | 'against'
}

export interface BeliefInput {
  evidence_for: EvidenceItem[]
  evidence_against: EvidenceItem[]
  status: 'active' | 'confirmed' | 'superseded' | 'rejected'
}

export interface BeliefOutput {
  confidence: number
  status: 'active' | 'confirmed' | 'superseded' | 'rejected'
}

const CONFIRM_THRESHOLD = 0.85
const SUPERSEDE_THRESHOLD = 0.2
const MIN_DATAPOINTS_FOR_CONFIRM = 4
const MAX_DECAY_DAYS = 60
const MIN_WEIGHT = 0.2

function weightFor(item: EvidenceItem, now: number): number {
  const daysOld = (now - new Date(item.date).getTime()) / 86_400_000
  const w = 1 - daysOld / MAX_DECAY_DAYS
  return Math.max(MIN_WEIGHT, Math.min(1, w))
}

export function recomputeBelief(input: BeliefInput): BeliefOutput {
  if (input.status === 'confirmed' || input.status === 'rejected') {
    const conf = computeConfidence(input)
    return { confidence: conf, status: input.status }
  }

  const confidence = computeConfidence(input)
  const n = input.evidence_for.length + input.evidence_against.length

  let status: BeliefOutput['status'] = 'active'
  if (confidence >= CONFIRM_THRESHOLD && n >= MIN_DATAPOINTS_FOR_CONFIRM) {
    status = 'confirmed'
  } else if (confidence < SUPERSEDE_THRESHOLD && n >= 2) {
    status = 'superseded'
  }

  return { confidence: Number(confidence.toFixed(2)), status }
}

function computeConfidence(input: BeliefInput): number {
  const now = Date.now()
  const wFor = input.evidence_for.reduce((s, e) => s + weightFor(e, now), 0)
  const wAgainst = input.evidence_against.reduce((s, e) => s + weightFor(e, now), 0)
  if (wFor + wAgainst === 0) return 0.5
  return wFor / (wFor + wAgainst)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/lib/ai/belief-update.test.ts`
Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/belief-update.ts tests/lib/ai/belief-update.test.ts
git commit -m "feat(coach): pure belief-update confidence recalc with time decay"
```

---

### Task 3: `belief-extractor.ts` (LLM-driven)

**Files:**
- Create: `src/lib/ai/belief-extractor.ts`
- Test: `tests/lib/ai/belief-extractor.test.ts`

This extractor takes a scoped event (chat-turn, sync-summary, ingest-summary) and proposes 0-2 new hypotheses or evidence-updates. It uses the same fire-and-forget pattern as `memory-extractor.ts`.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/ai/belief-extractor.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const generateTextMock = vi.fn()

vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => generateTextMock(...args),
}))

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => ({ name: 'mocked' })),
}))

const adminUpsert = vi.fn(async () => ({ error: null }))
const adminInsert = vi.fn(async () => ({ error: null }))
const adminUpdate = vi.fn(async () => ({ error: null }))
const adminSelectData = { data: [], error: null }

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            in: async () => adminSelectData,
          }),
          in: async () => adminSelectData,
        }),
      }),
      insert: adminInsert,
      update: () => ({ eq: adminUpdate }),
    }),
  }),
}))

vi.mock('@/lib/ai/usage', () => ({ logAiUsage: vi.fn() }))

beforeEach(() => {
  generateTextMock.mockReset()
  adminInsert.mockClear()
  adminUpdate.mockClear()
})

import { runBeliefExtractor } from '@/lib/ai/belief-extractor'

describe('runBeliefExtractor', () => {
  it('inserts a new belief when extractor returns one', async () => {
    generateTextMock.mockResolvedValue({
      text: JSON.stringify([
        {
          action: 'create',
          hypothesis_text: 'Ochtendsessies leveren betere PR-ratio',
          category: 'training',
          evidence: { kind: 'for', observation: 'Bench PR vandaag bij 7:00 sessie', source: 'hevy-sync' },
        },
      ]),
      usage: { inputTokens: 100, outputTokens: 50 },
    })

    await runBeliefExtractor({
      userId: 'user-1',
      scope: 'training',
      eventSummary: 'Bench Press 92.5kg x 5 PR',
    })

    expect(adminInsert).toHaveBeenCalledTimes(1)
    const call = adminInsert.mock.calls[0][0] as Record<string, unknown>
    expect(call.user_id).toBe('user-1')
    expect(call.category).toBe('training')
    expect(call.hypothesis_text).toContain('Ochtendsessies')
  })

  it('does nothing on empty array', async () => {
    generateTextMock.mockResolvedValue({
      text: '[]',
      usage: { inputTokens: 50, outputTokens: 2 },
    })
    await runBeliefExtractor({ userId: 'user-1', scope: 'training', eventSummary: 'niets bijzonders' })
    expect(adminInsert).not.toHaveBeenCalled()
    expect(adminUpdate).not.toHaveBeenCalled()
  })

  it('swallows JSON parse errors instead of throwing', async () => {
    generateTextMock.mockResolvedValue({ text: 'not json', usage: { inputTokens: 1, outputTokens: 1 } })
    await expect(
      runBeliefExtractor({ userId: 'user-1', scope: 'training', eventSummary: 'x' }),
    ).resolves.toBeUndefined()
  })

  it('swallows LLM errors instead of throwing', async () => {
    generateTextMock.mockRejectedValue(new Error('boom'))
    await expect(
      runBeliefExtractor({ userId: 'user-1', scope: 'training', eventSummary: 'x' }),
    ).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/lib/ai/belief-extractor.test.ts`
Expected: tests fail — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/ai/belief-extractor.ts`:

```typescript
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createAdminClient } from '@/lib/supabase/admin'
import { MEMORY_MODEL } from '@/lib/ai/client'
import { logAiUsage } from '@/lib/ai/usage'
import { recomputeBelief, type EvidenceItem } from '@/lib/ai/belief-update'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BeliefScope = 'training' | 'nutrition' | 'recovery' | 'lifestyle' | 'preference'

export interface RunBeliefExtractorInput {
  userId: string
  scope: BeliefScope
  eventSummary: string
}

interface ExtractorAction {
  action: 'create' | 'evidence'
  hypothesis_text?: string
  category?: BeliefScope
  target_id?: string
  evidence: {
    kind: 'for' | 'against'
    observation: string
    source: string
  }
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const EXTRACTOR_SYSTEM = `Je analyseert een gebeurtenis in Stefs trainings- of leefdata en stelt vast of er bewijs is voor een NIEUWE of BESTAANDE hypothese over hoe zijn lichaam reageert.

Output: JSON-array. Lege array [] als er niets meaningvols te zeggen is.

Acties:
- {"action":"create","hypothesis_text":"...","category":"training|nutrition|recovery|lifestyle|preference","evidence":{"kind":"for|against","observation":"...","source":"..."}}
- {"action":"evidence","target_id":"<uuid van bestaande belief>","evidence":{"kind":"for|against","observation":"...","source":"..."}}

Regels:
- Max 2 acties per call.
- "create" alleen bij echt nieuwe, falsifieerbare hypothese ("X leidt tot Y") — geen losse feiten.
- "evidence" als de gebeurtenis een bestaande hypothese ondersteunt of tegenspreekt.
- Geen vage uitspraken ("Stef sport graag"). Wel specifiek ("Slaap <6u → bench-prestatie zakt").
- Source kort: "hevy-sync"|"apple-health"|"chat-turn"|"checkin"|"manual".
- Geen uitleg, alleen JSON.`

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function runBeliefExtractor(input: RunBeliefExtractorInput): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data: existing } = await admin
      .from('coach_beliefs')
      .select('id, hypothesis_text, category, status')
      .eq('user_id', input.userId)
      .in('status', ['active', 'confirmed'])

    const existingBlock =
      existing && existing.length
        ? `\n\nBestaande hypotheses (refereer naar target_id voor evidence-updates):\n${existing
            .map((b) => `- [${b.id}] (${b.category}, ${b.status}) ${b.hypothesis_text}`)
            .join('\n')}`
        : ''

    const userMessage = `Scope: ${input.scope}\n\nGebeurtenis:\n${input.eventSummary.slice(0, 2000)}${existingBlock}`

    const startedAt = Date.now()
    const { text, usage } = await generateText({
      model: anthropic(MEMORY_MODEL),
      system: EXTRACTOR_SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
      maxOutputTokens: 512,
    })

    logAiUsage({
      userId: input.userId,
      feature: 'belief-extractor',
      model: MEMORY_MODEL,
      usage: {
        inputTokens: usage.inputTokens ?? null,
        outputTokens: usage.outputTokens ?? null,
        cacheReadTokens: null,
      },
      durationMs: Date.now() - startedAt,
    })

    let actions: ExtractorAction[]
    try {
      actions = JSON.parse(text)
    } catch {
      console.warn('[belief-extractor] non-JSON output:', text.slice(0, 200))
      return
    }
    if (!Array.isArray(actions) || actions.length === 0) return

    for (const action of actions.slice(0, 2)) {
      await applyAction(admin, input.userId, action)
    }
  } catch (err) {
    console.error('[belief-extractor] error (non-fatal):', err)
  }
}

// ---------------------------------------------------------------------------
// Action application
// ---------------------------------------------------------------------------

async function applyAction(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  action: ExtractorAction,
): Promise<void> {
  const nowIso = new Date().toISOString()
  const evidenceItem: EvidenceItem = {
    date: nowIso,
    observation: action.evidence.observation.slice(0, 240),
    source: action.evidence.source.slice(0, 40),
    kind: action.evidence.kind,
  }

  if (action.action === 'create') {
    if (!action.hypothesis_text || !action.category) return
    const initial = {
      evidence_for: action.evidence.kind === 'for' ? [evidenceItem] : [],
      evidence_against: action.evidence.kind === 'against' ? [evidenceItem] : [],
      status: 'active' as const,
    }
    const { confidence, status } = recomputeBelief(initial)
    await admin.from('coach_beliefs').insert({
      user_id: userId,
      hypothesis_text: action.hypothesis_text.slice(0, 240),
      category: action.category,
      evidence_for: initial.evidence_for,
      evidence_against: initial.evidence_against,
      confidence,
      status,
      last_tested_at: nowIso,
    })
    return
  }

  if (action.action === 'evidence' && action.target_id) {
    const { data } = await admin
      .from('coach_beliefs')
      .select('evidence_for, evidence_against, status')
      .eq('id', action.target_id)
      .eq('user_id', userId)
      .maybeSingle()
    if (!data) return

    const evidence_for = action.evidence.kind === 'for'
      ? [...(data.evidence_for as EvidenceItem[]), evidenceItem]
      : (data.evidence_for as EvidenceItem[])
    const evidence_against = action.evidence.kind === 'against'
      ? [...(data.evidence_against as EvidenceItem[]), evidenceItem]
      : (data.evidence_against as EvidenceItem[])

    const { confidence, status } = recomputeBelief({
      evidence_for,
      evidence_against,
      status: data.status as 'active' | 'confirmed' | 'superseded' | 'rejected',
    })

    await admin
      .from('coach_beliefs')
      .update({
        evidence_for,
        evidence_against,
        confidence,
        status,
        last_tested_at: nowIso,
      })
      .eq('id', action.target_id)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/lib/ai/belief-extractor.test.ts`
Expected: 4/4 pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/belief-extractor.ts tests/lib/ai/belief-extractor.test.ts
git commit -m "feat(coach): belief-extractor proposes hypotheses + adds evidence"
```

---

### Task 4: Hook belief-extractor in chat-route

**Files:**
- Modify: `src/app/api/chat/route.ts` (around line 545 where `extractAndUpdateMemory` is called)

- [ ] **Step 1: Add the import**

Open `src/app/api/chat/route.ts`. After the existing import on line 7:

```typescript
import { extractAndUpdateMemory } from '@/lib/ai/memory-extractor'
```

Add:

```typescript
import { runBeliefExtractor } from '@/lib/ai/belief-extractor'
```

- [ ] **Step 2: Add the fire-and-forget call**

Locate the block at ~line 545:

```typescript
          // Fire memory extraction after response is sent — non-blocking
          extractAndUpdateMemory(user.id, message, cleanText).catch(console.error)
```

Append directly after (same indentation):

```typescript
          // Fire belief extraction on the chat-turn — lifestyle/preference scope.
          // Fire-and-forget; errors are logged inside the extractor.
          runBeliefExtractor({
            userId: user.id,
            scope: 'lifestyle',
            eventSummary: `Stef zei: ${message}\n\nCoach antwoordde: ${cleanText.slice(0, 1500)}`,
          }).catch(console.error)
```

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run`
Expected: all green (no regressions).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat(coach): hook belief-extractor in chat-route (lifestyle scope)"
```

---

### Task 5: Hook belief-extractor in Hevy sync

**Files:**
- Modify: `src/lib/hevy/sync.ts:141` (`syncHevyWorkouts`)

- [ ] **Step 1: Locate the return statement**

Open `src/lib/hevy/sync.ts`. The function `syncHevyWorkouts(userId)` returns a `SyncResult` (look around the final `return { … }`).

- [ ] **Step 2: Add import at top of file**

After the existing imports, add:

```typescript
import { runBeliefExtractor } from '@/lib/ai/belief-extractor'
```

- [ ] **Step 3: Wrap the return**

Replace the final `return result` (or equivalent) at the end of `syncHevyWorkouts` with:

```typescript
  // Fire-and-forget belief extraction on training-scope events.
  // Only triggers when at least one workout was actually inserted.
  if (result.inserted > 0) {
    const summary = `Hevy sync klaar voor user ${userId}. Nieuw: ${result.inserted} workouts, geüpdatet: ${result.updated}. Laatste: ${result.lastWorkoutTitle ?? 'unknown'} (${result.lastWorkoutDuration ?? 0} min, ${result.lastWorkoutVolume ?? 0}kg volume).`
    runBeliefExtractor({ userId, scope: 'training', eventSummary: summary }).catch(console.error)
  }
  return result
```

Note: if `SyncResult` doesn't already contain `lastWorkoutTitle/Duration/Volume`, fall back to a compact JSON summary of the result object:

```typescript
    const summary = `Hevy sync klaar voor user ${userId}. Resultaat: ${JSON.stringify(result).slice(0, 1500)}`
```

Pick whichever variant matches the actual `SyncResult` shape (check via `Read` of `src/lib/hevy/sync.ts`).

- [ ] **Step 4: Type-check**

Run: `pnpm tsc --noEmit`
Expected: zero errors.

- [ ] **Step 5: Run tests**

Run: `pnpm vitest run`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/hevy/sync.ts
git commit -m "feat(coach): trigger belief-extractor after Hevy sync (training scope)"
```

---

### Task 6: Hook belief-extractor in Apple Health ingest

**Files:**
- Modify: `src/app/api/ingest/apple-health/route.ts`

- [ ] **Step 1: Add import**

At the top of `src/app/api/ingest/apple-health/route.ts`, add:

```typescript
import { runBeliefExtractor } from '@/lib/ai/belief-extractor'
```

- [ ] **Step 2: Find the success return**

Inside the `POST` handler, locate the path where ingest completes successfully (the response with insert counts). Just before that response, capture the relevant counts (sleep, hrv, steps) into a summary string.

- [ ] **Step 3: Add fire-and-forget call**

Insert immediately before the success `NextResponse.json(…)`:

```typescript
    // Fire-and-forget belief extraction — recovery scope.
    // Only fire if we actually ingested data (avoid noise on empty payloads).
    if (insertedTotals.sleep > 0 || insertedTotals.hrv > 0 || insertedTotals.heart_rate > 0) {
      const summary = `Apple Health ingest for user ${user.id}. Inserted: ${JSON.stringify(insertedTotals).slice(0, 800)}.`
      runBeliefExtractor({
        userId: user.id,
        scope: 'recovery',
        eventSummary: summary,
      }).catch(console.error)
    }
```

If `insertedTotals` is named differently in the file, use whatever counter object already exists (look around the response body) — keep the guard "fire only when something was inserted".

- [ ] **Step 4: Type-check**

Run: `pnpm tsc --noEmit`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ingest/apple-health/route.ts
git commit -m "feat(coach): trigger belief-extractor after Apple Health ingest (recovery scope)"
```

---

### Task 7: Beliefs in `buildMemoryReadBlock`

**Files:**
- Modify: `src/lib/ai/coach-core.ts`
- Modify: `tests/lib/ai/coach-core.test.ts`

- [ ] **Step 1: Extend the failing test**

Open `tests/lib/ai/coach-core.test.ts`. Add a new `vi.mock` factory variant or extend the existing one so a second query to `coach_beliefs` returns a row. Easiest: replace the mock with a stateful factory.

Replace the existing `vi.mock('@/lib/supabase/admin', …)` block with:

```typescript
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === 'coaching_memory') {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                gte: () => ({
                  order: () => ({
                    limit: async () => ({
                      data: [
                        {
                          id: '11111111-2222-3333-4444-555555555555',
                          category: 'preference',
                          value: "Stef traint het liefst 's ochtends",
                        },
                      ],
                    }),
                  }),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'coach_beliefs') {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [
                      {
                        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                        hypothesis_text: 'Ochtendsessies leveren betere PR-ratio',
                        category: 'training',
                        confidence: 0.78,
                        status: 'active',
                      },
                      {
                        id: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
                        hypothesis_text: 'Slaap < 6u → bench-prestatie zakt 1-2 reps',
                        category: 'recovery',
                        confidence: 0.92,
                        status: 'confirmed',
                      },
                    ],
                  }),
                }),
              }),
            }),
          }),
        }
      }
      return { select: () => ({}) }
    },
  })),
}))
```

Add a new test in the `describe('buildMemoryReadBlock', …)` block (or create one if absent):

```typescript
describe('buildMemoryReadBlock — beliefs', () => {
  it('renders confirmed and active beliefs under their own header', async () => {
    const out = await buildMemoryReadBlock('user-1')
    expect(out).toContain('MIJN WERKENDE HYPOTHESES OVER JOU')
    expect(out).toContain('Ochtendsessies')
    expect(out).toContain('confidence 0.78')
    expect(out).toContain('Slaap < 6u')
    expect(out).toContain('confirmed')
  })
})
```

- [ ] **Step 2: Run tests to verify the new test fails**

Run: `pnpm vitest run tests/lib/ai/coach-core.test.ts`
Expected: the new test fails (output missing the new header), older tests still pass.

- [ ] **Step 3: Extend `buildMemoryReadBlock` implementation**

In `src/lib/ai/coach-core.ts`, after the existing `lines.push(...)` for cited_memories instruction, but BEFORE the `return lines.join('\n')`, insert a new block that reads beliefs and appends them. Updated final version of `buildMemoryReadBlock`:

```typescript
export async function buildMemoryReadBlock(userId: string): Promise<string> {
  const admin = createAdminClient()

  const memQuery = admin
    .from('coaching_memory')
    .select('id, category, value')
    .eq('user_id', userId)
    .is('superseded_by', null)
    .gte('confidence', 0.3)
    .order('updated_at', { ascending: false })
    .limit(30)

  const beliefQuery = admin
    .from('coach_beliefs')
    .select('id, hypothesis_text, category, confidence, status')
    .eq('user_id', userId)
    .in('status', ['active', 'confirmed'])
    .order('confidence', { ascending: false })
    .limit(8)

  const [{ data: memData }, { data: beliefData }] = await Promise.all([memQuery, beliefQuery])

  const sections: string[] = []

  if (!memData || memData.length === 0) {
    sections.push('## MIJN GEHEUGEN OVER JOU\n\n(Nog geen geheugen opgebouwd — leer Stef nog kennen.)')
  } else {
    const byCategory: Record<string, Array<{ id: string; value: string }>> = {}
    for (const row of memData) {
      if (!byCategory[row.category]) byCategory[row.category] = []
      byCategory[row.category].push({ id: row.id, value: row.value })
    }
    const lines: string[] = ['## MIJN GEHEUGEN OVER JOU', '']
    for (const [cat, items] of Object.entries(byCategory)) {
      lines.push(`### ${cat.toUpperCase()}`)
      for (const it of items) {
        lines.push(`- [id:${it.id.slice(0, 8)}] ${it.value}`)
      }
      lines.push('')
    }
    lines.push(
      'Wanneer je naar een feit hier verwijst in je antwoord, eindig je antwoord met een `<cited_memories>id1,id2</cited_memories>`-tag met de id-prefixes die je gebruikt hebt. Dit houdt het geheugen vers.',
    )
    sections.push(lines.join('\n'))
  }

  if (beliefData && beliefData.length > 0) {
    const lines: string[] = ['', '## MIJN WERKENDE HYPOTHESES OVER JOU', '']
    for (const b of beliefData) {
      const tag = b.status === 'confirmed' ? 'confirmed' : `confidence ${Number(b.confidence).toFixed(2)}`
      lines.push(`- (${b.category}, ${tag}) ${b.hypothesis_text}`)
    }
    lines.push('')
    lines.push('Je mag deze hypotheses noemen, testen, of refereren wanneer relevant. Wanneer je tegenbewijs hebt, zeg het.')
    sections.push(lines.join('\n'))
  }

  return sections.join('\n')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/lib/ai/coach-core.test.ts`
Expected: all tests in the file pass.

- [ ] **Step 5: Run full suite**

Run: `pnpm vitest run`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/coach-core.ts tests/lib/ai/coach-core.test.ts
git commit -m "feat(coach): include beliefs block in buildMemoryReadBlock"
```

---

### Task 8: Wekelijkse safety-net cron `belief-sweep`

**Files:**
- Create: `src/app/api/cron/belief-sweep/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Write the cron route**

Create `src/app/api/cron/belief-sweep/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runBeliefExtractor, type BeliefScope } from '@/lib/ai/belief-extractor'

/**
 * GET /api/cron/belief-sweep
 * Schedule: 0 22 * * 0 (zondag 22:00 UTC = ma 00:00 Amsterdam)
 *
 * Safety-net: voor elke active belief die >7 dagen niet getest is, vragen we
 * de extractor om hem te heroverwegen op basis van een korte data-samenvatting.
 * Event-driven hooks dragen de hoofdmoot, dit vangt de rest op.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized', code: 'INVALID_CRON_SECRET' }, { status: 401 })
  }

  const admin = createAdminClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const { data: stale, error } = await admin
    .from('coach_beliefs')
    .select('id, user_id, category, hypothesis_text')
    .eq('status', 'active')
    .or(`last_tested_at.is.null,last_tested_at.lt.${sevenDaysAgo}`)
    .limit(50)

  if (error) {
    console.error('[belief-sweep] query failed:', error)
    return NextResponse.json({ error: 'Query failed', code: 'QUERY_FAILED' }, { status: 500 })
  }

  let triggered = 0
  for (const belief of stale ?? []) {
    await runBeliefExtractor({
      userId: belief.user_id,
      scope: belief.category as BeliefScope,
      eventSummary: `Wekelijkse safety-net sweep. Bestaande active hypothese (id ${belief.id}) is >7 dagen niet getest: "${belief.hypothesis_text}". Beoordeel of er sinds laatste test relevante nieuwe data is en voeg evidence toe waar gepast.`,
    })
    triggered++
  }

  return NextResponse.json({ ok: true, swept: triggered })
}
```

- [ ] **Step 2: Register the cron in `vercel.json`**

Open `vercel.json`. Add a fourth entry to the `crons` array:

```json
{
  "crons": [
    { "path": "/api/cron/hevy-sync", "schedule": "0 6 * * *" },
    { "path": "/api/cron/daily-aggregate", "schedule": "0 2 * * *" },
    { "path": "/api/cron/weekly-aggregate", "schedule": "0 3 * * 1" },
    { "path": "/api/cron/belief-sweep", "schedule": "0 22 * * 0" }
  ]
}
```

- [ ] **Step 3: Manual smoke test**

In a separate terminal, with the dev server running (`pnpm dev`):

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/belief-sweep
```

Expected: JSON `{"ok":true,"swept":<n>}` (n is 0 on fresh DB — fine).
Also: `curl … without header` → expect 401.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/belief-sweep/route.ts vercel.json
git commit -m "feat(coach): weekly safety-net cron for stale beliefs"
```

---

### Task 9: Migration `coach_questions` + RLS + types

**Files:**
- Create: `supabase/migrations/20260526000002_coach_questions.sql`
- Regen: `src/types/database.ts`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260526000002_coach_questions.sql`:

```sql
-- Migration: coach_questions — active inquiry storage
-- Coach uses ask_stef tool to write here; UI surfaces them via coach_inbox.

CREATE TABLE coach_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    urgency TEXT NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'expired', 'dismissed')),
    answer_text TEXT,
    related_belief_id UUID REFERENCES coach_beliefs(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    answered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_coach_questions_user ON coach_questions(user_id, status);
CREATE INDEX idx_coach_questions_expires ON coach_questions(expires_at) WHERE status = 'pending';

ALTER TABLE coach_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY coach_questions_select_own ON coach_questions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY coach_questions_modify_own ON coach_questions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY coach_questions_service_role ON coach_questions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Apply + regen types**

Run: `supabase db push && supabase gen types typescript --local > src/types/database.ts`
Expected: applies cleanly, types regenerated.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260526000002_coach_questions.sql src/types/database.ts
git commit -m "feat(coach): add coach_questions table for active inquiry"
```

---

### Task 10: Migration `coach_inbox` + helper

**Files:**
- Create: `supabase/migrations/20260526000003_coach_inbox.sql`
- Create: `src/lib/coach/inbox.ts`
- Test: `tests/lib/coach/inbox.test.ts`
- Regen: `src/types/database.ts`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260526000003_coach_inbox.sql`:

```sql
-- Migration: coach_inbox — unified inbox for proactive messages + questions

CREATE TABLE coach_inbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('anomaly', 'mid_block', 'morning_readiness', 'belief_question', 'post_workout', 'coach_question')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    requires_response BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'dismissed', 'actioned')),
    related_entity_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_coach_inbox_user_status ON coach_inbox(user_id, status, created_at DESC);

ALTER TABLE coach_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY coach_inbox_select_own ON coach_inbox
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY coach_inbox_modify_own ON coach_inbox
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY coach_inbox_service_role ON coach_inbox
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Apply + regen types**

Run: `supabase db push && supabase gen types typescript --local > src/types/database.ts`
Expected: applies cleanly.

- [ ] **Step 3: Write the failing test**

Create `tests/lib/coach/inbox.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const insertMock = vi.fn(async () => ({ error: null }))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({ insert: insertMock }),
  }),
}))

import { enqueueInboxItem } from '@/lib/coach/inbox'

beforeEach(() => insertMock.mockClear())

describe('enqueueInboxItem', () => {
  it('writes a row with defaults', async () => {
    await enqueueInboxItem({
      userId: 'user-1',
      type: 'coach_question',
      messageText: 'Slaap je beter zonder padel op woensdag?',
    })
    expect(insertMock).toHaveBeenCalledTimes(1)
    const row = insertMock.mock.calls[0][0] as Record<string, unknown>
    expect(row.user_id).toBe('user-1')
    expect(row.type).toBe('coach_question')
    expect(row.priority).toBe('medium')
    expect(row.requires_response).toBe(true)
    expect(row.status).toBe('unread')
  })

  it('respects overrides for priority and related id', async () => {
    await enqueueInboxItem({
      userId: 'user-1',
      type: 'anomaly',
      messageText: 'ACWR spike',
      priority: 'high',
      requiresResponse: false,
      relatedEntityId: 'workout-123',
    })
    const row = insertMock.mock.calls[0][0] as Record<string, unknown>
    expect(row.priority).toBe('high')
    expect(row.requires_response).toBe(false)
    expect(row.related_entity_id).toBe('workout-123')
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/coach/inbox.test.ts`
Expected: fails — module not found.

- [ ] **Step 5: Write helper implementation**

Create `src/lib/coach/inbox.ts`:

```typescript
import { createAdminClient } from '@/lib/supabase/admin'

export type InboxType =
  | 'anomaly'
  | 'mid_block'
  | 'morning_readiness'
  | 'belief_question'
  | 'post_workout'
  | 'coach_question'

export type InboxPriority = 'low' | 'medium' | 'high'

export interface EnqueueInboxItemInput {
  userId: string
  type: InboxType
  messageText: string
  priority?: InboxPriority
  requiresResponse?: boolean
  relatedEntityId?: string
}

const REQUIRES_RESPONSE_DEFAULT: Record<InboxType, boolean> = {
  anomaly: false,
  mid_block: true,
  morning_readiness: false,
  belief_question: true,
  post_workout: true,
  coach_question: true,
}

export async function enqueueInboxItem(input: EnqueueInboxItemInput): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from('coach_inbox').insert({
    user_id: input.userId,
    type: input.type,
    message_text: input.messageText.slice(0, 1000),
    priority: input.priority ?? 'medium',
    requires_response: input.requiresResponse ?? REQUIRES_RESPONSE_DEFAULT[input.type],
    status: 'unread',
    related_entity_id: input.relatedEntityId ?? null,
  })
  if (error) console.error('[inbox] enqueue failed:', error)
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run tests/lib/coach/inbox.test.ts`
Expected: 2/2 pass.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260526000003_coach_inbox.sql src/lib/coach/inbox.ts tests/lib/coach/inbox.test.ts src/types/database.ts
git commit -m "feat(coach): coach_inbox table + enqueue helper"
```

---

### Task 11: `ask_stef` tool

**Files:**
- Create: `src/lib/ai/tools/handlers/ask-stef.ts`
- Modify: `src/lib/ai/tools/definitions.ts`

The tool writes a row to `coach_questions` AND mirrors it into `coach_inbox` (type `coach_question`) so the existing inbox UI surfaces it. Coach calls this when he wants to know something off-topic-for-this-chat.

- [ ] **Step 1: Write the handler**

Create `src/lib/ai/tools/handlers/ask-stef.ts`:

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { enqueueInboxItem } from '@/lib/coach/inbox'

export interface AskStefInput {
  question: string
  urgency: 'low' | 'medium' | 'high'
  related_belief_id?: string | null
}

const EXPIRES_DAYS: Record<AskStefInput['urgency'], number> = {
  low: 14,
  medium: 7,
  high: 3,
}

export async function askStef(userId: string, input: AskStefInput) {
  const admin = createAdminClient()
  const expiresAt = new Date(Date.now() + EXPIRES_DAYS[input.urgency] * 86_400_000).toISOString()

  const { data, error } = await admin
    .from('coach_questions')
    .insert({
      user_id: userId,
      question_text: input.question.slice(0, 500),
      urgency: input.urgency,
      status: 'pending',
      related_belief_id: input.related_belief_id ?? null,
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[ask_stef] insert failed:', error)
    return { ok: false, error: 'Could not store question' }
  }

  await enqueueInboxItem({
    userId,
    type: 'coach_question',
    messageText: input.question.slice(0, 500),
    priority: input.urgency,
    requiresResponse: true,
    relatedEntityId: data.id,
  })

  return { ok: true, question_id: data.id, expires_at: expiresAt }
}
```

- [ ] **Step 2: Register tool in `definitions.ts`**

Open `src/lib/ai/tools/definitions.ts`. Add to the import section near the top:

```typescript
import { askStef } from './handlers/ask-stef'
```

Above `createToolsForUser`, add the schema:

```typescript
const askStefSchema = z.object({
  question: z.string().min(8).max(500).describe('De vraag voor Stef in natuurlijk Nederlands. Eén concrete vraag, geen lijst.'),
  urgency: z.enum(['low', 'medium', 'high']).describe('Hoe urgent het is — bepaalt vervaldatum (2w/1w/3d).'),
  related_belief_id: z.string().uuid().nullable().optional().describe('Optioneel: id van belief die deze vraag gaat beantwoorden.'),
})
```

Inside `createToolsForUser(userId)`'s returned object, add a new tool entry (before the closing `}`):

```typescript
    ask_stef: tool({
      description: `Stel Stef een gerichte vraag wanneer je iets wilt weten dat off-topic is voor de huidige chat, of nodig is om een hypothese te testen. De vraag verschijnt in zijn coach-inbox. Gebruik spaarzaam — max één keer per chat-turn, alleen als het antwoord daadwerkelijk je advies of geheugen zou verbeteren.`,
      inputSchema: askStefSchema,
      execute: async (input) => askStef(userId, input),
    }),
```

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/tools/handlers/ask-stef.ts src/lib/ai/tools/definitions.ts
git commit -m "feat(coach): ask_stef tool — coach can post questions to inbox"
```

---

### Task 12: API routes for coach-inbox

**Files:**
- Create: `src/app/api/coach-inbox/route.ts`
- Create: `src/app/api/coach-inbox/[id]/route.ts`
- Create: `src/app/api/coach-questions/[id]/answer/route.ts`

- [ ] **Step 1: Write list route**

Create `src/app/api/coach-inbox/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })

  const { data, error } = await supabase
    .from('coach_inbox')
    .select('id, message_text, type, priority, requires_response, status, related_entity_id, created_at')
    .eq('user_id', user.id)
    .in('status', ['unread', 'read'])
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[GET /api/coach-inbox] failed:', error)
    return NextResponse.json({ error: 'Failed to load inbox', code: 'QUERY_FAILED' }, { status: 500 })
  }

  const unreadCount = (data ?? []).filter((row) => row.status === 'unread').length
  return NextResponse.json({ items: data ?? [], unreadCount })
}
```

- [ ] **Step 2: Write single-item PATCH route**

Create `src/app/api/coach-inbox/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const PatchSchema = z.object({
  status: z.enum(['unread', 'read', 'dismissed', 'actioned']),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const { id } = await params
  const { error } = await supabase
    .from('coach_inbox')
    .update({ status: parsed.data.status })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[PATCH /api/coach-inbox/:id] failed:', error)
    return NextResponse.json({ error: 'Failed to update', code: 'UPDATE_FAILED' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Write answer route for coach-questions**

Create `src/app/api/coach-questions/[id]/answer/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { runBeliefExtractor } from '@/lib/ai/belief-extractor'

const AnswerSchema = z.object({
  answer_text: z.string().min(1).max(2000),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })

  const body = await req.json()
  const parsed = AnswerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const { id } = await params

  const { data: question, error: qErr } = await supabase
    .from('coach_questions')
    .select('id, question_text, related_belief_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (qErr || !question) {
    return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const nowIso = new Date().toISOString()
  const { error: updErr } = await supabase
    .from('coach_questions')
    .update({ status: 'answered', answer_text: parsed.data.answer_text, answered_at: nowIso })
    .eq('id', id)
    .eq('user_id', user.id)

  if (updErr) {
    return NextResponse.json({ error: 'Failed to save', code: 'UPDATE_FAILED' }, { status: 500 })
  }

  // Mark the matching inbox card as actioned (fire-and-forget)
  await supabase
    .from('coach_inbox')
    .update({ status: 'actioned' })
    .eq('user_id', user.id)
    .eq('related_entity_id', id)

  // Feed the answer to belief-extractor so the answered question becomes evidence
  runBeliefExtractor({
    userId: user.id,
    scope: 'lifestyle',
    eventSummary: `Coach vroeg: "${question.question_text}". Stef antwoordde: "${parsed.data.answer_text.slice(0, 800)}". Gerelateerde belief: ${question.related_belief_id ?? 'geen'}.`,
  }).catch(console.error)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Type-check + smoke test**

Run: `pnpm tsc --noEmit`
Expected: zero errors.

Smoke test (with dev server + logged-in cookie):

```bash
curl -s -b "<session-cookie>" http://localhost:3000/api/coach-inbox | jq
```

Expected: `{ "items": [], "unreadCount": 0 }`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/coach-inbox src/app/api/coach-questions
git commit -m "feat(coach): inbox + coach-question answer API routes"
```

---

### Task 13: Inbox UI (bell + dropdown list)

**Files:**
- Create: `src/components/coach/InboxBell.tsx`
- Create: `src/components/coach/InboxList.tsx`
- Create: `src/components/coach/InboxCard.tsx`
- Modify: existing home header (where the user-menu lives) to mount `InboxBell`

- [ ] **Step 1: Locate the home header**

Run: `grep -rln "SignOutButton\|UserMenu" src/components/home src/app | head -5`

Open the file that renders the top-bar on `/home`. We will mount `<InboxBell />` next to whatever account icon already exists.

- [ ] **Step 2: Write `InboxBell` component**

Create `src/components/coach/InboxBell.tsx`:

```tsx
'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { InboxList } from './InboxList'

interface InboxResponse {
  items: Array<{
    id: string
    message_text: string
    type: string
    priority: 'low' | 'medium' | 'high'
    requires_response: boolean
    status: 'unread' | 'read' | 'dismissed' | 'actioned'
    related_entity_id: string | null
    created_at: string
  }>
  unreadCount: number
}

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<InboxResponse>)

export function InboxBell() {
  const [open, setOpen] = useState(false)
  const { data, mutate } = useSWR<InboxResponse>('/api/coach-inbox', fetcher, { refreshInterval: 60_000 })
  const unread = data?.unreadCount ?? 0

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#1E2230] border border-white/5 text-white/80 hover:text-white"
        aria-label={`Coach inbox (${unread} ongelezen)`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D97757] px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <InboxList
          items={data?.items ?? []}
          onClose={() => setOpen(false)}
          onMutate={() => mutate()}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Write `InboxCard`**

Create `src/components/coach/InboxCard.tsx`:

```tsx
'use client'

import { useState } from 'react'

interface InboxItem {
  id: string
  message_text: string
  type: string
  priority: 'low' | 'medium' | 'high'
  requires_response: boolean
  status: 'unread' | 'read' | 'dismissed' | 'actioned'
  related_entity_id: string | null
  created_at: string
}

interface Props {
  item: InboxItem
  onChanged: () => void
}

const TYPE_LABEL: Record<string, string> = {
  anomaly: 'Anomalie',
  mid_block: 'Blok-check',
  morning_readiness: 'Ochtend-readiness',
  belief_question: 'Hypothese-check',
  post_workout: 'Post-workout',
  coach_question: 'Vraag van coach',
}

export function InboxCard({ item, onChanged }: Props) {
  const [answer, setAnswer] = useState('')
  const [answering, setAnswering] = useState(false)
  const [busy, setBusy] = useState(false)

  async function patch(status: 'read' | 'dismissed' | 'actioned') {
    setBusy(true)
    await fetch(`/api/coach-inbox/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setBusy(false)
    onChanged()
  }

  async function submitAnswer() {
    if (!item.related_entity_id || answer.trim().length === 0) return
    setBusy(true)
    const res = await fetch(`/api/coach-questions/${item.related_entity_id}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer_text: answer }),
    })
    setBusy(false)
    if (res.ok) {
      setAnswering(false)
      setAnswer('')
      onChanged()
    }
  }

  const isUnread = item.status === 'unread'
  return (
    <div className={`rounded-[14px] border border-white/5 p-3 ${isUnread ? 'bg-[#222636]' : 'bg-[#1E2230]'}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-white/50">{TYPE_LABEL[item.type] ?? item.type}</span>
        {item.priority === 'high' && <span className="text-[11px] font-medium text-[#FF5E3A]">Belangrijk</span>}
      </div>
      <p className="text-sm text-white">{item.message_text}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {item.requires_response && item.type === 'coach_question' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setAnswering((v) => !v)}
            className="rounded-full bg-[#D97757] px-3 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50"
          >
            {answering ? 'Sluit' : 'Beantwoorden'}
          </button>
        )}
        {isUnread && (
          <button
            type="button"
            disabled={busy}
            onClick={() => patch('read')}
            className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/80 hover:bg-white/10 disabled:opacity-50"
          >
            Markeer gelezen
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => patch('dismissed')}
          className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/60 hover:bg-white/10 disabled:opacity-50"
        >
          Negeren
        </button>
      </div>
      {answering && (
        <div className="mt-2">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
            placeholder="Jouw antwoord…"
            className="w-full rounded-lg border border-white/10 bg-[#15171F] p-2 text-sm text-white focus:border-[#D97757] focus:outline-none"
          />
          <button
            type="button"
            disabled={busy || answer.trim().length === 0}
            onClick={submitAnswer}
            className="mt-1 rounded-full bg-[#D97757] px-3 py-1 text-xs text-white disabled:opacity-50"
          >
            Versturen
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Write `InboxList`**

Create `src/components/coach/InboxList.tsx`:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { InboxCard } from './InboxCard'

interface InboxItem {
  id: string
  message_text: string
  type: string
  priority: 'low' | 'medium' | 'high'
  requires_response: boolean
  status: 'unread' | 'read' | 'dismissed' | 'actioned'
  related_entity_id: string | null
  created_at: string
}

interface Props {
  items: InboxItem[]
  onClose: () => void
  onMutate: () => void
}

const PRIORITY_ORDER: Record<InboxItem['priority'], number> = { high: 0, medium: 1, low: 2 }

export function InboxList({ items, onClose, onMutate }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const sorted = [...items].sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (p !== 0) return p
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <div
      ref={ref}
      className="absolute right-0 top-11 z-50 max-h-[70vh] w-[340px] overflow-y-auto rounded-[18px] border border-white/5 bg-[#15171F] p-3 shadow-xl"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Coach-inbox</h3>
        <button type="button" onClick={onClose} className="text-white/40 hover:text-white" aria-label="Sluit">
          ×
        </button>
      </div>
      {sorted.length === 0 ? (
        <p className="px-1 py-4 text-xs text-white/50">Niets om over te lezen — de coach houdt zich gedeisd.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((item) => (
            <InboxCard key={item.id} item={item} onChanged={onMutate} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Mount `InboxBell` in the home header**

Edit the file you located in Step 1. Add the import:

```tsx
import { InboxBell } from '@/components/coach/InboxBell'
```

Mount it next to the existing top-bar controls (alongside the avatar/menu):

```tsx
<InboxBell />
```

- [ ] **Step 6: Manual smoke test**

Start dev server: `pnpm dev`. Log in. Insert a test row directly:

```bash
psql "$DATABASE_URL" <<'SQL'
INSERT INTO coach_inbox (user_id, message_text, type, priority)
VALUES ((SELECT id FROM profiles LIMIT 1), 'Test bericht — vraagje?', 'coach_question', 'medium');
SQL
```

Refresh /home → bell shows `1`. Click bell → card shows up. "Markeer gelezen" → badge disappears. "Negeren" → card disappears.

- [ ] **Step 7: Commit**

```bash
git add src/components/coach src/app
git commit -m "feat(coach): unified inbox bell + dropdown UI"
```

---

### Task 14: Beliefs-review pagina

**Files:**
- Create: `src/app/api/coach-beliefs/route.ts`
- Create: `src/app/api/coach-beliefs/[id]/route.ts`
- Create: `src/app/coach/beliefs/page.tsx`

Beliefs are critical to coach quality — Stef must be able to inspect + confirm/reject them.

- [ ] **Step 1: Write list API**

Create `src/app/api/coach-beliefs/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })

  const { data, error } = await supabase
    .from('coach_beliefs')
    .select('id, hypothesis_text, category, confidence, status, evidence_for, evidence_against, last_tested_at, created_at')
    .eq('user_id', user.id)
    .in('status', ['active', 'confirmed'])
    .order('confidence', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[GET /api/coach-beliefs] failed:', error)
    return NextResponse.json({ error: 'Failed', code: 'QUERY_FAILED' }, { status: 500 })
  }

  return NextResponse.json({ beliefs: data ?? [] })
}
```

- [ ] **Step 2: Write PATCH API**

Create `src/app/api/coach-beliefs/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const PatchSchema = z.object({
  action: z.enum(['confirm', 'reject']),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid', code: 'VALIDATION_ERROR' }, { status: 400 })

  const { id } = await params
  const nextStatus = parsed.data.action === 'confirm' ? 'confirmed' : 'rejected'
  const nextConfidence = parsed.data.action === 'confirm' ? 1.0 : 0.0

  const { error } = await supabase
    .from('coach_beliefs')
    .update({ status: nextStatus, confidence: nextConfidence })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[PATCH /api/coach-beliefs/:id] failed:', error)
    return NextResponse.json({ error: 'Failed', code: 'UPDATE_FAILED' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Write the page**

Create `src/app/coach/beliefs/page.tsx`:

```tsx
'use client'

import useSWR from 'swr'

interface Belief {
  id: string
  hypothesis_text: string
  category: 'training' | 'nutrition' | 'recovery' | 'lifestyle' | 'preference'
  confidence: number
  status: 'active' | 'confirmed'
  evidence_for: Array<{ date: string; observation: string; source: string }>
  evidence_against: Array<{ date: string; observation: string; source: string }>
  last_tested_at: string | null
  created_at: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<{ beliefs: Belief[] }>)

export default function BeliefsReviewPage() {
  const { data, mutate } = useSWR<{ beliefs: Belief[] }>('/api/coach-beliefs', fetcher)

  async function act(id: string, action: 'confirm' | 'reject') {
    await fetch(`/api/coach-beliefs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    mutate()
  }

  const beliefs = data?.beliefs ?? []

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-xl font-semibold text-white">Wat de coach denkt over jou</h1>
      <p className="mb-6 text-sm text-white/60">
        Werkende hypotheses op basis van je data. Confirm wat klopt, reject wat fout is — dat verbetert wat ik tegen je zeg.
      </p>

      {beliefs.length === 0 && <p className="text-sm text-white/50">Nog geen hypotheses opgebouwd.</p>}

      <div className="flex flex-col gap-3">
        {beliefs.map((b) => (
          <article key={b.id} className="rounded-[18px] border border-white/5 bg-[#1E2230] p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-white/50">{b.category}</span>
              <span className="text-[11px] text-white/40">
                {b.status === 'confirmed' ? 'Bevestigd' : `confidence ${b.confidence.toFixed(2)}`}
              </span>
            </div>
            <p className="text-sm text-white">{b.hypothesis_text}</p>

            {(b.evidence_for.length > 0 || b.evidence_against.length > 0) && (
              <details className="mt-2 text-xs text-white/60">
                <summary className="cursor-pointer text-white/50">Bewijs ({b.evidence_for.length}/{b.evidence_against.length})</summary>
                <ul className="mt-1 space-y-1">
                  {b.evidence_for.map((e, i) => (
                    <li key={`f-${i}`}>+ {e.observation} <span className="text-white/30">({e.source})</span></li>
                  ))}
                  {b.evidence_against.map((e, i) => (
                    <li key={`a-${i}`} className="text-white/50">− {e.observation} <span className="text-white/30">({e.source})</span></li>
                  ))}
                </ul>
              </details>
            )}

            {b.status === 'active' && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => act(b.id, 'confirm')}
                  className="rounded-full bg-[#00E5C7] px-3 py-1 text-xs font-medium text-[#0a0a0a]"
                >
                  Klopt
                </button>
                <button
                  type="button"
                  onClick={() => act(b.id, 'reject')}
                  className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
                >
                  Klopt niet
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Type-check + smoke test**

Run: `pnpm tsc --noEmit`
Expected: zero errors.

Insert a test belief, then open `/coach/beliefs`:

```bash
psql "$DATABASE_URL" <<'SQL'
INSERT INTO coach_beliefs (user_id, hypothesis_text, category, evidence_for, confidence, last_tested_at)
VALUES (
  (SELECT id FROM profiles LIMIT 1),
  'Ochtendsessies leveren betere PR-ratio',
  'training',
  '[{"date":"2026-05-25T07:00:00Z","observation":"Bench PR 92.5kg","source":"hevy-sync","kind":"for"}]'::jsonb,
  0.65, now()
);
SQL
```

Open `/coach/beliefs`. Click "Klopt" → row updates to confirmed. Refresh → status stays confirmed.

- [ ] **Step 5: Run full test suite**

Run: `pnpm vitest run && pnpm tsc --noEmit`
Expected: green + zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/coach-beliefs src/app/coach/beliefs
git commit -m "feat(coach): belief-review page + confirm/reject API"
```

---

## Wrap-up

After all 14 tasks complete:

- [ ] **Step 1: Full type-check**

Run: `pnpm tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: Full test suite**

Run: `pnpm vitest run`
Expected: green across the board (existing + 13 new tests).

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: zero new warnings.

- [ ] **Step 4: Manual end-to-end**

1. Dev server up (`pnpm dev`), sign in as `stef@pulse.test`.
2. Insert one active belief + one inbox item via psql (Tasks 13 + 14 smoke tests).
3. Bell badge shows 1; click → card visible.
4. Open `/coach/beliefs` → row visible, confirm → badge OK.
5. Open chat, ask "wat denk je over mijn ochtendsessies?" — coach response references the belief.
6. Trigger Hevy manual sync → check Vercel logs for `belief-extractor` calls (or local console).

- [ ] **Step 5: Handoff to finishing-a-development-branch**

Once everything passes, invoke `superpowers:finishing-a-development-branch` to choose merge vs PR.

---

## Out of scope reminders (do not implement in this fase)

- Post-workout check-in wizard (fase 3)
- Mid-block / morning-readiness crons (fase 3)
- Workout anomaly detection (fase 3)
- Mobile push notifications

---

## Self-review notes

- All spec deliverables (1-11) for Fase 2 are mapped to a task above:
  - Spec #1 (coach_beliefs migration) → Task 1
  - Spec #2 (belief-extractor) → Task 3
  - Spec #3 (event-driven hooks) → Tasks 4, 5, 6
  - Spec #4 (belief-update pure fn) → Task 2
  - Spec #5 (weekly safety-net sweep) → Task 8
  - Spec #6 (beliefs in buildMemoryReadBlock) → Task 7
  - Spec #7 (coach_questions migration) → Task 9
  - Spec #8 (ask_stef tool) → Task 11
  - Spec #9 (coach_inbox migration) → Task 10
  - Spec #10 (unified inbox UI) → Tasks 12, 13
  - Spec #11 (belief-review UI) → Task 14
