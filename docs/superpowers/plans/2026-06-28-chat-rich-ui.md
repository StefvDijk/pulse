# Chat Redesign — Plan 2: Rich Chat UI (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the rich chat experience defined in spec §3.3–§3.4: inline data cards (informational + write-back confirmation), message timestamps with time-separators, credit-balance error handling, a rich empty-state hero, "open in last session" on Coach-tab mount, and UX-09 nudge session anchoring.

**Architecture:** Extends the existing write-back-tag mechanism (`writebacks.ts` / `strip-stream-tags.ts`) with a new card library (`cards.ts`). The route emits `__card` SSE events after the prose stream closes. The frontend accumulates card events and attaches them to the completed assistant message. `ChatInterface` gains a `forceNew` prop so "Nieuwe chat" shows the empty hero while a bare Coach-tab mount loads the last session. UX-09 uses localStorage keyed on `signalId` with a new `onSessionCreated` callback chain from `ChatInterface` → `ChatPage` → `CoachCard`.

**Tech Stack:** Next.js 16 (App Router, streaming route handlers, `after()`), React 19, TypeScript strict, Zod, SWR, Tailwind dark tokens, Vitest + @testing-library/react, Playwright.

**Spec:** `docs/superpowers/specs/2026-06-27-chat-ux-redesign-design.md` §3.3, §3.4, §4, §9. This plan is Plan 2; Plan 1 (navigation + history) is the prerequisite; Plan 3 covers photo attachments.

---

## Global Constraints

- TypeScript strict; **no `any`** (use `unknown` + narrowing). Immutable updates (spread, no mutation).
- Auth on every route: `const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();` → `401 { error: 'Unauthorized', code: 'AUTH_REQUIRED' }`. Data via `createAdminClient()` with `.eq('user_id', user.id)`.
- Error shape: `{ error: string, code: string }`; 500 fallback `{ error, code: 'INTERNAL_ERROR' }` logged with `console.error`.
- Next 16 dynamic route signature: `(_req: Request, { params }: { params: Promise<{ id: string }> })` then `const { id } = await params`.
- Tailwind dark tokens only (`text-text-primary`, `bg-bg-surface`, `status-good`, sport accents, etc.). No new hex literals unless mirroring a design token.
- Conventional commits (`feat:`, `fix:`, `refactor:`, `test:`). Commit after each task.
- Run from repo root with `pnpm`. **Never run against `.env.local`** (production). Tests use mocks; manual checks use local Supabase.
- Vitest `globals: false` → every component test imports `{ describe, it, expect, vi, afterEach }` from `vitest` and calls `afterEach(() => cleanup())` (see `tests/ui/Sheet.test.tsx` as reference).
- `after()` is imported from `'next/server'` (stable in Next 16). It may be called from within the stream's `start` callback — that is valid because `start` executes within the request's async context.
- E2E tests write specs and verify via `playwright test --list`; **do not run** against `.env.local` = prod.

---

## File Structure

**New:**
- `src/lib/ai/chat/cards.ts` — Zod schemas, `AnyCard` union, `parseCards`, `makeWritebackCard`, `stripCardTagsFromText`, `CHAT_CARD_TAGS`
- `src/lib/ai/chat/stream-errors.ts` — `StreamErrorEvent`, `classifyStreamError` (extracted from `route.ts` for testability)
- `src/components/chat/TimeSeparator.tsx` — time-separator between messages on different days
- `src/components/chat/cards/CardRenderer.tsx` — registry dispatcher
- `src/components/chat/cards/WorkoutCard.tsx`
- `src/components/chat/cards/WeekplanCard.tsx`
- `src/components/chat/cards/StatCard.tsx`
- `src/components/chat/cards/WritebackCard.tsx`
- `src/components/chat/cards/index.ts`
- `tests/lib/chat/cards.test.ts`
- `tests/lib/chat/writeback-card.test.ts`
- `tests/lib/chat/stream-errors.test.ts`
- `tests/ui/CardRenderer.test.tsx`
- `tests/ui/TimeSeparator.test.tsx`
- `tests/chat-rich-ui.spec.ts` (Playwright)

**Modified:**
- `src/lib/ai/chat/writebacks.ts` — add `card?: WritebackCardData` to `WritebackOutcome`; call `makeWritebackCard` on success
- `src/app/api/chat/route.ts` — expand stripper tags, call `parseCards`+`stripCardTagsFromText`, emit `__card` SSE events, use `after()`, import `classifyStreamError` from new module
- `src/lib/ai/prompts/chat-system.ts` — add card-tag contract to write-back instructions
- `src/components/chat/ChatMessage.tsx` — add `timestamp?` + `cards?` props; render time + card list
- `src/components/chat/ChatInterface.tsx` — `Message` type gains `created_at` + `cards`; parse `__card` SSE events; `forceNew` prop; load-last-session default; add `onSessionCreated` prop; rich empty hero; remove ChatSuggestions
- `src/components/chat/ChatPage.tsx` — add `forceNew` state; add `initialSessionId` + `signalId` props; wire `onSessionCreated` → localStorage
- `src/components/dashboard/v2/CoachCard.tsx` — UX-09: check stored session before navigating; navigate with `?signal=` param
- `src/app/(app)/chat/page.tsx` — read `session_id` + `signal` from searchParams; pass to ChatPage

**Deleted:**
- `src/components/chat/ChatSuggestions.tsx`
- `src/app/api/chat/suggestions/route.ts`

---

## Phase A — Inline data cards + write-back confirmation

### Task A1: Card library — `cards.ts` + tests

**Files:**
- Create: `src/lib/ai/chat/cards.ts`
- Create: `tests/lib/chat/cards.test.ts`
- Modify: `tests/lib/ai/strip-stream-tags.test.ts` (add card-tag stripping test)

**Interfaces:**
- Consumes: `zod` (already a dependency).
- Produces: `WorkoutCardData`, `WeekplanCardData`, `StatCardData`, `WritebackCardData`, `AnyCard`, `CHAT_CARD_TAGS`, `parseCards(rawText): AnyCard[]`, `makeWritebackCard(kind): WritebackCardData`, `stripCardTagsFromText(text): string`.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/chat/cards.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  parseCards,
  makeWritebackCard,
  stripCardTagsFromText,
} from '@/lib/ai/chat/cards'

describe('parseCards', () => {
  it('extracts a valid workout_card', () => {
    const raw =
      'Goed werk! <workout_card>{"title":"Squat Day","date":"2026-06-28","sport":"gym","duration_min":65,"rpe":7,"exercises":[{"name":"Squat","sets":4,"reps":"6","weight_kg":80}],"highlights":["PR 80kg"]}</workout_card>'
    const cards = parseCards(raw)
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ type: 'workout', title: 'Squat Day', sport: 'gym' })
  })

  it('extracts a valid weekplan_card', () => {
    const raw =
      '<weekplan_card>{"week":"2026-W26","sessions":[{"day":"monday","focus":"Upper A","duration_min":55},{"day":"thursday","focus":"Lower A"}]}</weekplan_card>'
    const cards = parseCards(raw)
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ type: 'weekplan_card', week: '2026-W26' })
  })

  it('extracts a valid stat_card', () => {
    const raw =
      '<stat_card>{"label":"Bench 1RM","value":"92.5","unit":"kg","trend":"up","context":"+2.5kg vs vorige blok"}</stat_card>'
    const cards = parseCards(raw)
    expect(cards[0]).toMatchObject({ type: 'stat_card', label: 'Bench 1RM', trend: 'up' })
  })

  it('silently drops a card with invalid JSON', () => {
    const raw = '<workout_card>{not valid json}</workout_card>Goed werk.'
    expect(parseCards(raw)).toHaveLength(0)
  })

  it('silently drops a card that fails Zod validation (missing required sport)', () => {
    const raw = '<workout_card>{"title":"Squat Day","date":"2026-06-28"}</workout_card>'
    expect(parseCards(raw)).toHaveLength(0)
  })

  it('extracts multiple card types from one response', () => {
    const raw =
      '<workout_card>{"title":"Squat","date":"2026-06-28","sport":"gym"}</workout_card>' +
      '<stat_card>{"label":"Volume","value":"14000","unit":"kg"}</stat_card>'
    expect(parseCards(raw)).toHaveLength(2)
  })

  it('returns [] when no card tags are present', () => {
    expect(parseCards('Gewoon een antwoord zonder kaarten.')).toHaveLength(0)
  })
})

describe('makeWritebackCard', () => {
  it('returns a writeback_card with the correct label for nutrition', () => {
    const card = makeWritebackCard('nutrition')
    expect(card).toMatchObject({ type: 'writeback_card', kind: 'nutrition' })
    expect(card.label).toContain('Voeding')
  })

  it('covers all four kinds', () => {
    const kinds = ['nutrition', 'injury', 'schema_generation', 'schema_update'] as const
    for (const kind of kinds) {
      const card = makeWritebackCard(kind)
      expect(card.kind).toBe(kind)
      expect(card.label.length).toBeGreaterThan(3)
    }
  })
})

describe('stripCardTagsFromText', () => {
  it('removes all card tags from clean text', () => {
    const raw =
      'Hier is je plan. <weekplan_card>{"week":"2026-W26","sessions":[]}</weekplan_card> Veel succes!'
    expect(stripCardTagsFromText(raw)).toBe('Hier is je plan.  Veel succes!')
  })

  it('returns text unchanged when no card tags present', () => {
    expect(stripCardTagsFromText('Goed zo!')).toBe('Goed zo!')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/chat/cards.test.ts`
Expected: FAIL — cannot find module `@/lib/ai/chat/cards`.

- [ ] **Step 3: Implement `cards.ts`**

Create `src/lib/ai/chat/cards.ts`:

```ts
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Zod schemas (Plan 2 §3.4 — closed set of typed informational card tags).
// The coach may emit these tags inline; `createStreamTagStripper` removes them
// from the visible stream while the route extracts them for `__card` SSE events.
// ---------------------------------------------------------------------------

export const WorkoutCardSchema = z.object({
  type: z.literal('workout'),
  title: z.string(),
  date: z.string(),               // ISO date or relative label, e.g. "morgen"
  sport: z.string(),              // e.g. "gym", "run", "padel"
  duration_min: z.number().optional(),
  rpe: z.number().optional(),
  exercises: z.array(z.object({
    name: z.string(),
    sets: z.number().optional(),
    reps: z.string().optional(),   // "6" or "8-10"
    weight_kg: z.number().optional(),
    note: z.string().optional(),
  })).optional(),
  highlights: z.array(z.string()).optional(),
})
export type WorkoutCardData = z.infer<typeof WorkoutCardSchema>

export const WeekplanCardSchema = z.object({
  type: z.literal('weekplan_card'),
  week: z.string().regex(/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/),
  sessions: z
    .array(
      z.object({
        day: z.enum([
          'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
        ]),
        focus: z.string().min(1).max(80),
        duration_min: z.number().positive().optional(),
      }),
    )
    .min(1)
    .max(7),
  note: z.string().max(200).optional(),
})
export type WeekplanCardData = z.infer<typeof WeekplanCardSchema>

export const StatCardSchema = z.object({
  type: z.literal('stat_card'),
  label: z.string().min(1).max(60),
  value: z.string().min(1).max(40),
  unit: z.string().max(20).optional(),
  trend: z.enum(['up', 'down', 'flat']).optional(),
  context: z.string().max(200).optional(),
})
export type StatCardData = z.infer<typeof StatCardSchema>

export const WritebackCardSchema = z.object({
  type: z.literal('writeback_card'),
  kind: z.enum(['nutrition', 'injury', 'schema_generation', 'schema_update']),
  label: z.string().min(1).max(80),
})
export type WritebackCardData = z.infer<typeof WritebackCardSchema>

export const AnyCardSchema = z.discriminatedUnion('type', [
  WorkoutCardSchema,
  WeekplanCardSchema,
  StatCardSchema,
  WritebackCardSchema,
])
export type AnyCard = z.infer<typeof AnyCardSchema>

// ---- Constants ---------------------------------------------------------------

/** Tag names the coach may emit inline for informational cards. */
export const CHAT_CARD_TAGS = ['workout_card', 'weekplan_card', 'stat_card'] as const

// ---- Helpers -----------------------------------------------------------------

function extractTagInner(text: string, tag: string): string | null {
  const m = new RegExp(`<${tag}\\s*>([\\s\\S]*?)</${tag}\\s*>`, 'i').exec(text)
  return m ? m[1].trim() : null
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/**
 * Extract and validate all informational card tags from the raw (unstripped)
 * response. Invalid or truncated tags are silently dropped — prose is unaffected.
 */
export function parseCards(rawText: string): AnyCard[] {
  const cards: AnyCard[] = []
  for (const tag of CHAT_CARD_TAGS) {
    const inner = extractTagInner(rawText, tag)
    if (!inner) continue
    const json = safeJson(inner)
    if (json === undefined) {
      console.error(`[chat/cards] malformed JSON in <${tag}>`)
      continue
    }
    const raw =
      typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {}
    let result: ReturnType<typeof WorkoutCardSchema.safeParse>
    if (tag === 'workout_card') result = WorkoutCardSchema.safeParse({ ...raw, type: 'workout' })
    else if (tag === 'weekplan_card') result = WeekplanCardSchema.safeParse({ ...raw, type: tag })
    else result = StatCardSchema.safeParse({ ...raw, type: tag })
    if (result.success) {
      cards.push(result.data as AnyCard)
    } else {
      console.error(`[chat/cards] invalid <${tag}> payload:`, result.error.message)
    }
  }
  return cards
}

const WRITEBACK_LABELS: Record<WritebackCardData['kind'], string> = {
  nutrition: '✓ Voeding gelogd',
  injury: '✓ Blessure vastgelegd',
  schema_generation: '✓ Schema opgeslagen',
  schema_update: '✓ Schema aangepast',
}

/** Construct a write-back confirmation card for a successful write. */
export function makeWritebackCard(kind: WritebackCardData['kind']): WritebackCardData {
  return { type: 'writeback_card', kind, label: WRITEBACK_LABELS[kind] }
}

/**
 * Strip all informational card tags from text (used before saving `finalText`
 * to the DB so stored content matches what the user saw in the stream).
 */
export function stripCardTagsFromText(text: string): string {
  let out = text
  for (const tag of CHAT_CARD_TAGS) {
    out = out.replace(new RegExp(`<${tag}\\s*>[\\s\\S]*?</${tag}\\s*>`, 'gi'), '')
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/chat/cards.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Add card-tag test to strip-stream-tags test file**

Append one `it()` inside the existing `describe('createStreamTagStripper', ...)` block in `tests/lib/ai/strip-stream-tags.test.ts`:

```ts
it('strips workout_card when included in tag list', () => {
  const s = createStreamTagStripper(['workout_card'])
  let out = ''
  out += s.feed('<workout_card>{"title":"Squat Day","date":"2026-06-28","sport":"gym"}</workout_card>')
  out += s.feed('Goed werk!')
  out += s.flush()
  expect(out).toBe('Goed werk!')
  expect(out).not.toContain('<workout_card>')
})
```

Run: `pnpm vitest run tests/lib/ai/strip-stream-tags.test.ts`
Expected: PASS (all existing tests + 1 new = 9 tests total).

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/chat/cards.ts tests/lib/chat/cards.test.ts tests/lib/ai/strip-stream-tags.test.ts
git commit -m "feat(chat): add card library — schemas, parseCards, makeWritebackCard"
```

---

### Task A2: Extend `WritebackOutcome` + route SSE emission

**Files:**
- Modify: `src/lib/ai/chat/writebacks.ts`
- Modify: `src/app/api/chat/route.ts`
- Create: `tests/lib/chat/writeback-card.test.ts`

**Interfaces:**
- Consumes: `cards.ts` (Task A1), existing `writebacks.ts` and `route.ts`.
- Produces: `WritebackOutcome.card?: WritebackCardData`; route emits `data: {"__card":{...}}\n\n` for every successful write-back and every extracted informational card, before `[DONE]`. `finalText` stored to DB has card tags stripped.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/chat/writeback-card.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/nutrition/analyze', () => ({
  analyzeNutrition: vi.fn().mockResolvedValue(undefined),
}))

import { applyWritebacks, parseWritebacks } from '@/lib/ai/chat/writebacks'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const mockAdmin = {} as SupabaseClient<Database>

describe('WritebackOutcome card field', () => {
  it('includes a writeback_card for a successful nutrition write', async () => {
    const parsed = parseWritebacks(
      '<nutrition_log>{"input":"200g kwark"}</nutrition_log>Genoteerd.',
    )
    const outcomes = await applyWritebacks(mockAdmin, 'u1', parsed)
    const o = outcomes.find((x) => x.kind === 'nutrition')
    expect(o?.ok).toBe(true)
    expect(o?.card).toMatchObject({ type: 'writeback_card', kind: 'nutrition' })
    expect(o?.card?.label).toContain('Voeding')
  })

  it('does not include a card when the write fails', async () => {
    // Force a Zod parse failure by sending malformed JSON
    const parsed = parseWritebacks('<nutrition_log>{broken}</nutrition_log>')
    const outcomes = await applyWritebacks(mockAdmin, 'u1', parsed)
    const o = outcomes.find((x) => x.kind === 'nutrition')
    expect(o?.ok).toBe(false)
    expect(o?.card).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/lib/chat/writeback-card.test.ts`
Expected: FAIL — `o?.card` is `undefined` (field not yet added).

- [ ] **Step 3: Extend `writebacks.ts`**

Add the import and update the interface + each `applyXxx` return value:

```ts
// At the top, add after existing imports:
import { makeWritebackCard, type WritebackCardData } from './cards'
```

Update `WritebackOutcome`:

```ts
export interface WritebackOutcome {
  kind: 'nutrition' | 'injury' | 'schema_generation' | 'schema_update'
  ok: boolean
  /** A line to append to the answer when the write failed or was blocked. */
  correction?: string
  /** Confirmation card sent to the frontend after a successful write. */
  card?: WritebackCardData
}
```

In `applyNutrition`, change the success return:

```ts
    return { kind: 'nutrition', ok: true, card: makeWritebackCard('nutrition') }
```

In `applyInjury`, change the success return:

```ts
  return { kind: 'injury', ok: true, card: makeWritebackCard('injury') }
```

In `applySchemaGeneration`, change the success return (inside the `try` block, after `update is_active`):

```ts
    return { kind: 'schema_generation', ok: true, card: makeWritebackCard('schema_generation') }
```

In `applySchemaUpdateWriteback`, change the success return:

```ts
    return { kind: 'schema_update', ok: true, card: makeWritebackCard('schema_update') }
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run tests/lib/chat/writeback-card.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Update `route.ts`**

Add imports at the top (after the existing writeback import line):

```ts
import { after } from 'next/server'
import { parseCards, stripCardTagsFromText, CHAT_CARD_TAGS } from '@/lib/ai/chat/chat/cards'
```

Wait — the correct import path:

```ts
import { parseCards, stripCardTagsFromText, CHAT_CARD_TAGS } from '@/lib/ai/chat/cards'
```

Change the stripper instantiation (currently around line 284):

```ts
// BEFORE:
const stripper = createStreamTagStripper(CHAT_WRITEBACK_TAGS)

// AFTER:
const stripper = createStreamTagStripper([...CHAT_WRITEBACK_TAGS, ...CHAT_CARD_TAGS])
```

After `const parsed = parseWritebacks(fullResponse)`, change:

```ts
// BEFORE:
const { cleanText, citedMemories } = parsed

// AFTER:
const infoCards = parseCards(fullResponse)
// Strip card tags from cleanText before DB save (the stream stripper already
// removed them from the displayed stream; here we fix the stored copy).
const cleanText = stripCardTagsFromText(parsed.cleanText)
const { citedMemories } = parsed
```

Before the `controller.enqueue(encoder.encode('data: [DONE]\n\n'))` line (i.e., after the session update and before `[DONE]`), add the card emission block:

```ts
          // Emit card events: write-back confirmations + informational cards.
          // Must precede [DONE] so the frontend receives them in the same read loop.
          const confirmCards = outcomes
            .filter((o): o is typeof o & { card: NonNullable<typeof o.card> } => o.ok && o.card !== undefined)
            .map((o) => o.card)
          for (const card of [...infoCards, ...confirmCards]) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ __card: card })}\n\n`),
            )
          }
```

Replace the two fire-and-forget calls with `after()`:

```ts
          // BEFORE:
          if (questionType !== 'simple_greeting') {
            extractAndUpdateMemory(user.id, message, cleanText).catch(console.error)
            runBeliefExtractor({
              userId: user.id,
              scope: 'lifestyle',
              eventSummary: `Stef zei: ${message}\n\nCoach antwoordde: ${cleanText.slice(0, 1500)}`,
            }).catch(console.error)
          }

          // AFTER:
          if (questionType !== 'simple_greeting') {
            after(async () => {
              await extractAndUpdateMemory(user.id, message, cleanText).catch(console.error)
            })
            after(async () => {
              await runBeliefExtractor({
                userId: user.id,
                scope: 'lifestyle',
                eventSummary: `Stef zei: ${message}\n\nCoach antwoordde: ${cleanText.slice(0, 1500)}`,
              }).catch(console.error)
            })
          }
```

- [ ] **Step 6: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS — no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/chat/writebacks.ts src/app/api/chat/route.ts tests/lib/chat/writeback-card.test.ts
git commit -m "feat(chat): emit __card SSE events for write-backs and info cards; after() for extractors"
```

---

### Task A3: Card React components

**Files:**
- Create: `src/components/chat/cards/WorkoutCard.tsx`
- Create: `src/components/chat/cards/WeekplanCard.tsx`
- Create: `src/components/chat/cards/StatCard.tsx`
- Create: `src/components/chat/cards/WritebackCard.tsx`
- Create: `src/components/chat/cards/CardRenderer.tsx`
- Create: `src/components/chat/cards/index.ts`
- Create: `tests/ui/CardRenderer.test.tsx`

**Interfaces:**
- Consumes: `AnyCard`, individual `*Data` types from `@/lib/ai/chat/cards`.
- Produces: `CardRenderer({ card: AnyCard })` — dispatches to the correct component; renders `null` for unknown type (future-safe). Each card component receives its typed `data` prop.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/CardRenderer.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { CardRenderer } from '@/components/chat/cards/CardRenderer'
import type { AnyCard } from '@/lib/ai/chat/cards'

afterEach(() => { cleanup() })

describe('CardRenderer', () => {
  it('renders WorkoutCard for workout_card', () => {
    const card: AnyCard = { type: 'workout', title: 'Squat Day', date: '2026-06-28', sport: 'gym' }
    const { getByText } = render(<CardRenderer card={card} />)
    expect(getByText('Squat Day')).toBeTruthy()
  })

  it('renders exercise row with sets × reps and weight', () => {
    const card: AnyCard = {
      type: 'workout',
      title: 'Push Day',
      date: '2026-06-28',
      sport: 'gym',
      exercises: [{ name: 'Bench Press', sets: 4, reps: '6', weight_kg: 80 }],
    }
    const { getByText } = render(<CardRenderer card={card} />)
    expect(getByText('4 × 6')).toBeTruthy()
    expect(getByText('@ 80kg')).toBeTruthy()
  })

  it('renders WeekplanCard for weekplan_card', () => {
    const card: AnyCard = {
      type: 'weekplan_card',
      week: '2026-W26',
      sessions: [{ day: 'monday', focus: 'Upper A' }],
    }
    const { getByText } = render(<CardRenderer card={card} />)
    expect(getByText('Upper A')).toBeTruthy()
  })

  it('renders StatCard for stat_card', () => {
    const card: AnyCard = { type: 'stat_card', label: 'Bench 1RM', value: '92.5', unit: 'kg' }
    const { getByText } = render(<CardRenderer card={card} />)
    expect(getByText('Bench 1RM')).toBeTruthy()
    expect(getByText('92.5')).toBeTruthy()
  })

  it('renders WritebackCard for writeback_card', () => {
    const card: AnyCard = { type: 'writeback_card', kind: 'nutrition', label: '✓ Voeding gelogd' }
    const { getByText } = render(<CardRenderer card={card} />)
    expect(getByText('✓ Voeding gelogd')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/ui/CardRenderer.test.tsx`
Expected: FAIL — cannot find module `@/components/chat/cards/CardRenderer`.

- [ ] **Step 3: Implement card components**

Create `src/components/chat/cards/WorkoutCard.tsx`:

```tsx
'use client'

import type { WorkoutCardData } from '@/lib/ai/chat/cards'

const SPORT_STYLES: Record<string, string> = {
  gym:   'text-[#00E5C7] bg-[#00E5C7]/[0.08] border-[#00E5C7]/[0.3]',
  run:   'text-[#FF5E3A] bg-[#FF5E3A]/[0.08] border-[#FF5E3A]/[0.3]',
  padel: 'text-[#FFB020] bg-[#FFB020]/[0.08] border-[#FFB020]/[0.3]',
  cycle: 'text-[#9CFF4F] bg-[#9CFF4F]/[0.08] border-[#9CFF4F]/[0.3]',
}
const SPORT_LABELS: Record<string, string> = {
  gym: 'Gym', run: 'Run', padel: 'Padel', cycle: 'Fiets',
}

export interface WorkoutCardProps { data: WorkoutCardData }

export function WorkoutCard({ data }: WorkoutCardProps) {
  const sportStyle =
    SPORT_STYLES[data.sport] ?? 'text-text-secondary bg-white/[0.06] border-white/[0.1]'
  return (
    <div className="mt-2 rounded-[13px] border-[0.5px] border-white/[0.08] bg-white/[0.04] px-3 py-2.5">
      {/* Header: sport badge · title · optional duration · optional RPE */}
      <div className="flex items-center gap-2">
        <span
          className={`shrink-0 rounded-full border-[0.5px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.4px] ${sportStyle}`}
        >
          {SPORT_LABELS[data.sport] ?? data.sport}
        </span>
        <span className="flex-1 truncate text-body font-semibold text-text-primary">{data.title}</span>
        {data.duration_min != null && (
          <span className="shrink-0 text-caption1 text-text-tertiary">{data.duration_min} min</span>
        )}
        {data.rpe != null && (
          <span className="shrink-0 text-caption1 text-text-tertiary">RPE {data.rpe}</span>
        )}
      </div>
      <p className="mt-0.5 text-caption1 text-text-tertiary">{data.date}</p>
      {/* Exercise rows: name · sets × reps · @ weight_kg kg */}
      {data.exercises && data.exercises.length > 0 && (
        <div className="mt-2 space-y-1">
          {data.exercises.map((ex, i) => (
            <div key={i} className="flex items-baseline gap-2 text-caption1">
              <span className="flex-1 truncate text-text-secondary">{ex.name}</span>
              {ex.sets != null && ex.reps != null && (
                <span className="shrink-0 text-text-tertiary">{ex.sets} × {ex.reps}</span>
              )}
              {ex.weight_kg != null && (
                <span className="shrink-0 text-text-tertiary">@ {ex.weight_kg}kg</span>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Highlights */}
      {data.highlights && data.highlights.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {data.highlights.map((h, i) => (
            <li key={i} className="flex items-center gap-1.5 text-caption1 text-text-secondary">
              <span className="h-1 w-1 shrink-0 rounded-full bg-text-tertiary" aria-hidden="true" />
              {h}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

Create `src/components/chat/cards/WeekplanCard.tsx`:

```tsx
'use client'

import type { WeekplanCardData } from '@/lib/ai/chat/cards'

const DAY_NL: Record<string, string> = {
  monday: 'ma', tuesday: 'di', wednesday: 'wo', thursday: 'do',
  friday: 'vr', saturday: 'za', sunday: 'zo',
}

export interface WeekplanCardProps { data: WeekplanCardData }

export function WeekplanCard({ data }: WeekplanCardProps) {
  return (
    <div className="mt-2 rounded-[13px] border-[0.5px] border-[rgba(0,229,199,0.2)] bg-[rgba(0,229,199,0.04)] px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-caption1 font-semibold uppercase tracking-[0.4px] text-text-tertiary">
          Weekplan
        </span>
        <span className="text-caption1 text-text-tertiary">{data.week}</span>
      </div>
      <div className="mt-2 space-y-1">
        {data.sessions.map((s, i) => (
          <div key={i} className="flex items-baseline gap-2">
            <span className="w-6 shrink-0 text-caption1 font-medium text-text-tertiary">
              {DAY_NL[s.day] ?? s.day.slice(0, 2)}
            </span>
            <span className="text-caption1 text-text-secondary">{s.focus}</span>
            {s.duration_min != null && (
              <span className="ml-auto shrink-0 text-[11px] text-text-tertiary">{s.duration_min}m</span>
            )}
          </div>
        ))}
      </div>
      {data.note && (
        <p className="mt-1.5 text-[11px] italic text-text-tertiary">{data.note}</p>
      )}
    </div>
  )
}
```

Create `src/components/chat/cards/StatCard.tsx`:

```tsx
'use client'

import type { StatCardData } from '@/lib/ai/chat/cards'

const TREND_ICON: Record<string, string> = { up: '↑', down: '↓', flat: '→' }
const TREND_COLOR: Record<string, string> = {
  up: 'text-status-good', down: 'text-status-bad', flat: 'text-text-tertiary',
}

export interface StatCardProps { data: StatCardData }

export function StatCard({ data }: StatCardProps) {
  return (
    <div className="mt-2 rounded-[13px] border-[0.5px] border-white/[0.08] bg-white/[0.04] px-3 py-2.5">
      <p className="text-caption1 text-text-tertiary">{data.label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[22px] font-bold leading-none text-text-primary">{data.value}</span>
        {data.unit && <span className="text-body text-text-secondary">{data.unit}</span>}
        {data.trend && (
          <span
            className={`ml-auto text-body font-semibold ${TREND_COLOR[data.trend] ?? 'text-text-tertiary'}`}
          >
            {TREND_ICON[data.trend]}
          </span>
        )}
      </div>
      {data.context && (
        <p className="mt-0.5 text-[11px] text-text-tertiary">{data.context}</p>
      )}
    </div>
  )
}
```

Create `src/components/chat/cards/WritebackCard.tsx`:

```tsx
'use client'

import type { WritebackCardData } from '@/lib/ai/chat/cards'

export interface WritebackCardProps { data: WritebackCardData }

export function WritebackCard({ data }: WritebackCardProps) {
  return (
    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-[rgba(0,229,199,0.4)] bg-[rgba(0,229,199,0.1)] px-3 py-1">
      <span className="text-caption1 font-semibold text-[#00E5C7]">{data.label}</span>
    </div>
  )
}
```

Create `src/components/chat/cards/CardRenderer.tsx`:

```tsx
'use client'

import type { AnyCard } from '@/lib/ai/chat/cards'
import { WorkoutCard } from './WorkoutCard'
import { WeekplanCard } from './WeekplanCard'
import { StatCard } from './StatCard'
import { WritebackCard } from './WritebackCard'

export interface CardRendererProps {
  card: AnyCard
}

export function CardRenderer({ card }: CardRendererProps) {
  if (card.type === 'workout') return <WorkoutCard data={card} />
  if (card.type === 'weekplan_card') return <WeekplanCard data={card} />
  if (card.type === 'stat_card') return <StatCard data={card} />
  if (card.type === 'writeback_card') return <WritebackCard data={card} />
  // TypeScript: card has type `never` here — future-safe no-op
  return null
}
```

Create `src/components/chat/cards/index.ts`:

```ts
export { CardRenderer } from './CardRenderer'
export { WorkoutCard } from './WorkoutCard'
export { WeekplanCard } from './WeekplanCard'
export { StatCard } from './StatCard'
export { WritebackCard } from './WritebackCard'
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run tests/ui/CardRenderer.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/cards/ tests/ui/CardRenderer.test.tsx
git commit -m "feat(chat): add card components — WorkoutCard, WeekplanCard, StatCard, WritebackCard, CardRenderer"
```

---

### Task A4: Wire ChatInterface + ChatMessage + system prompt

**Files:**
- Modify: `src/components/chat/ChatInterface.tsx`
- Modify: `src/components/chat/ChatMessage.tsx`
- Modify: `src/lib/ai/prompts/chat-system.ts`

**Interfaces:**
- Consumes: `AnyCard`, `AnyCardSchema` from `@/lib/ai/chat/cards`; `CardRenderer` from `@/components/chat/cards`.
- Produces: `Message.cards?: AnyCard[]`; `ChatMessageProps.cards?: AnyCard[]`; `ChatInterface` parses `__card` SSE events and attaches them to the completed assistant message; `ChatMessage` renders `CardRenderer` below each assistant bubble; `chat-system.ts` documents the card-tag contract.

- [ ] **Step 1: Update `ChatMessage.tsx`**

Add the import and update props + render. Full replacement of the file (only adding `cards` prop rendering under the assistant bubble):

```tsx
'use client'

import { memo } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CoachOrb } from '@/components/shared/CoachOrb'
import { CardRenderer } from '@/components/chat/cards/CardRenderer'
import type { AnyCard } from '@/lib/ai/chat/cards'

export interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  timestamp?: string | null
  cards?: AnyCard[]
}

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mb-2 mt-3 text-headline font-semibold text-text-primary">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1.5 mt-3 text-subhead font-semibold text-text-primary">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-2 text-subhead font-medium text-text-secondary">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="text-subhead">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  code: ({ children }) => (
    <code className="rounded px-1 py-0.5 text-caption1 bg-white/[0.08] text-[#0A84FF] font-mono">
      {children}
    </code>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-caption1">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-bg-border">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-2 py-1 text-left font-medium text-text-secondary">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-2 py-1 border-b border-bg-border">{children}</td>
  ),
  tr: ({ children }) => <tr>{children}</tr>,
}

const REMARK_PLUGINS = [remarkGfm]

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function ChatMessageImpl({ role, content, isStreaming, timestamp, cards }: ChatMessageProps) {
  const isUser = role === 'user'

  if (isUser) {
    return (
      <div className="flex flex-col items-end">
        <div className="flex justify-end">
          <div
            className="max-w-[80%] bg-bg-elevated text-text-primary text-subhead px-4 py-2.5"
            style={{ borderRadius: 'var(--radius-card-md) var(--radius-card-md) 6px var(--radius-card-md)' }}
          >
            <p className="whitespace-pre-wrap">{content}</p>
          </div>
        </div>
        {timestamp && !isStreaming && (
          <time
            dateTime={timestamp}
            className="mt-0.5 pr-1 text-[10px] text-text-tertiary"
          >
            {formatTime(timestamp)}
          </time>
        )}
      </div>
    )
  }

  // Assistant bubble
  return (
    <div className="flex flex-col">
      <div className="flex items-end gap-2">
        <CoachOrb
          size={20}
          state={isStreaming ? 'streaming' : 'idle'}
          className="mb-0.5 shrink-0 self-end"
        />
        <div
          className="max-w-[85%] bg-gradient-coach text-text-primary text-subhead px-4 py-2.5 border-[0.5px] border-white/[0.08]"
          style={{ borderRadius: 'var(--radius-card-md) var(--radius-card-md) var(--radius-card-md) 6px' }}
        >
          <div className="max-w-none">
            <Markdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
              {content}
            </Markdown>
            {isStreaming && content.length === 0 && (
              <span className="inline-flex gap-1 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary animate-bounce [animation-delay:300ms]" />
              </span>
            )}
          </div>
          {/* Cards render below prose, inside the bubble */}
          {cards && cards.length > 0 && (
            <div className="mt-1">
              {cards.map((card, i) => (
                <CardRenderer key={`${card.type}-${i}`} card={card} />
              ))}
            </div>
          )}
        </div>
      </div>
      {timestamp && !isStreaming && (
        <time
          dateTime={timestamp}
          className="mt-0.5 ml-7 text-[10px] text-text-tertiary"
        >
          {formatTime(timestamp)}
        </time>
      )}
    </div>
  )
}

export const ChatMessage = memo(ChatMessageImpl)
```

- [ ] **Step 2: Update `ChatInterface.tsx` to parse `__card` SSE events**

Add the `AnyCard` and `AnyCardSchema` imports at the top:

```ts
import { AnyCardSchema } from '@/lib/ai/chat/cards'
import type { AnyCard } from '@/lib/ai/chat/cards'
```

Update the `Message` interface:

```ts
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string | null
  cards?: AnyCard[]
}
```

Inside `handleSend`, add `pendingCards` alongside `accumulated`:

```ts
        let accumulated = ''
        let errorEvent: { code: string; message: string } | null = null
        let pendingCards: AnyCard[] = []
```

In the SSE parse loop, add a `__card` branch after the `__error` branch:

```ts
              } else if (
                parsed &&
                typeof parsed === 'object' &&
                '__card' in parsed
              ) {
                const cardResult = AnyCardSchema.safeParse(
                  (parsed as { __card: unknown }).__card,
                )
                if (cardResult.success) pendingCards.push(cardResult.data)
              }
```

When creating the assistant message, include `cards`:

```ts
          const assistantMsg: Message = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: accumulated,
            created_at: new Date().toISOString(),
            cards: pendingCards.length > 0 ? [...pendingCards] : undefined,
          }
```

When rendering the message list, pass `cards` to `ChatMessage`:

```tsx
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              role={msg.role}
              content={msg.content}
              timestamp={msg.created_at}
              cards={msg.cards}
            />
          ))}
```

- [ ] **Step 3: Add card-tag contract to `chat-system.ts`**

Inside `buildSystemPromptBlocks`, append the card contract section to `writeBackInstructions`. Find the string where `writeBackInstructions` ends (the `cited_memories` block) and append:

```ts
  const cardInstructions = `### Informatiekaarten (optioneel — gebruik spaarzaam)
Gebruik de volgende tags om een gestructureerde kaart mee te sturen naast je antwoord.
De app stript ze uit de zichtbare tekst en toont ze als kaarten onder je bericht.
Gebruik ze alleen als de kaart echt meer waarde toevoegt dan proza, en vul alleen bekende waarden in.

\`\`\`
<workout_card>{"name":"Naam van de training","date":"YYYY-MM-DD","sport":"gym|run|padel|cycle","sets":<n>,"duration_min":<n>,"highlights":["key insight"]}</workout_card>
\`\`\`
Gebruik voor: een specifieke workout samenvatten of uitlichten.

\`\`\`
<weekplan_card>{"week":"YYYY-W##","sessions":[{"day":"monday","focus":"Upper A","duration_min":55}],"note":"optionele toelichting"}</weekplan_card>
\`\`\`
Gebruik voor: een weekoverzicht van het trainingsplan tonen.

\`\`\`
<stat_card>{"label":"Bench 1RM","value":"92.5","unit":"kg","trend":"up","context":"+2.5kg vs vorige blok"}</stat_card>
\`\`\`
Gebruik voor: één concrete statistiek uitlichten (PR, volume, gewicht, trend).

Regels: één tag per type per antwoord · \`trend\` alleen als je het echt weet · nooit schatten.`
```

Then update the `systemStatic` assembly to include `cardInstructions` after `writeBackInstructions`:

```ts
  const systemStatic = [
    staticSections,
    customSection,
    writeBackInstructions,
    cardInstructions,
    'Je ontvangt een DATA-CONTEXT blok met actuele gegevens. Gebruik deze data om je antwoorden te personaliseren.',
  ]
    .filter(Boolean)
    .join('\n\n---\n\n')
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS — no errors.

- [ ] **Step 5: Write Playwright spec**

Create `tests/chat-rich-ui.spec.ts` (spec only — verified via `--list` since `.env.local` = prod):

```ts
import { test, expect } from '@playwright/test'

test('coach message renders a writeback confirmation card after logging nutrition', async ({ page }) => {
  await page.goto('/chat')
  // Verify an existing chat message has a writeback card chip visible
  // (relies on a seeded session with a past nutrition log confirmation)
  // Full assertion requires a test-env Supabase seed — see tests/fixtures.
  await expect(page.getByRole('main')).toBeVisible()
})

test('coach message renders a stat card when one is present in history', async ({ page }) => {
  await page.goto('/chat')
  await expect(page.getByRole('main')).toBeVisible()
})
```

Run: `pnpm test:e2e --list`
Expected: output includes `chat-rich-ui.spec.ts` with 2 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/chat/ChatMessage.tsx src/components/chat/ChatInterface.tsx src/lib/ai/prompts/chat-system.ts tests/chat-rich-ui.spec.ts
git commit -m "feat(chat): wire __card SSE to ChatInterface/ChatMessage; add card-tag contract to system prompt"
```

---

### Task A5: Remove dead chat-suggestions API route and hooks

**Files:**
- Delete: `src/app/api/chat/suggestions/route.ts`
- Modify: any files in `src/components/chat`, `src/hooks`, or `src/app/api` that still reference chat suggestions after Task C1

**Interfaces:**
- Consumes: nothing new.
- Produces: the suggestions API route and all dangling client-side chat-suggestions imports/hooks are gone.

> **Ordering note:** Task C1 deletes `ChatSuggestions.tsx` and removes its imports/state from `ChatInterface.tsx`. Run A5 **after C1** to avoid touching those files twice. If following strict phase order (A → B → C), defer A5 until after Phase C Task C1 is complete.

- [ ] **Step 1: Delete the suggestions API route**

```bash
git rm src/app/api/chat/suggestions/route.ts
```

- [ ] **Step 2: Find and remove remaining chat-suggestions references**

```bash
grep -rn "suggestions" src/app/api src/components/chat src/hooks
```

Review the output. Remove any imports, hooks (`useChatSuggestions`, etc.), or references that are related to **chat suggestions specifically** — do NOT touch unrelated "suggestions" (e.g. check-in suggestions, coach feature proposals, or any other domain feature named "suggestions").

- [ ] **Step 3: Verify**

```bash
grep -rn "suggestions" src/app/api src/components/chat src/hooks
```

Expected: no chat-suggestions entries remain (unrelated uses are fine).

Run: `pnpm typecheck`
Expected: PASS — no dangling imports.

Run: `pnpm test`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(chat): remove dead chat-suggestions API route and hooks"
```

---

## Phase B — Message metadata + errors

### Task B1: Timestamps + TimeSeparator

**Files:**
- Create: `src/components/chat/TimeSeparator.tsx`
- Create: `tests/ui/TimeSeparator.test.tsx`
- Modify: `src/components/chat/ChatInterface.tsx`

**Interfaces:**
- Consumes: `Message.created_at` (set in Task A4 for sent messages; loaded from history).
- Produces: `TimeSeparator({ dateLabel: string })` — thin horizontal rule with centred label. Message list renders a separator between consecutive messages on different calendar days. History mapping passes `created_at` through.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/TimeSeparator.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { TimeSeparator } from '@/components/chat/TimeSeparator'

afterEach(() => { cleanup() })

it('renders the provided date label', () => {
  const { getByText } = render(<TimeSeparator dateLabel="Gisteren" />)
  expect(getByText('Gisteren')).toBeTruthy()
})

it('renders the label for "Vandaag"', () => {
  const { getByText } = render(<TimeSeparator dateLabel="Vandaag" />)
  expect(getByText('Vandaag')).toBeTruthy()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/ui/TimeSeparator.test.tsx`
Expected: FAIL — cannot find module `@/components/chat/TimeSeparator`.

- [ ] **Step 3: Implement `TimeSeparator`**

Create `src/components/chat/TimeSeparator.tsx`:

```tsx
'use client'

export interface TimeSeparatorProps {
  dateLabel: string
}

export function TimeSeparator({ dateLabel }: TimeSeparatorProps) {
  return (
    <div className="flex items-center gap-3 py-1" role="separator" aria-label={dateLabel}>
      <div className="flex-1 border-t-[0.5px] border-bg-border" />
      <span className="shrink-0 text-[10px] text-text-tertiary">{dateLabel}</span>
      <div className="flex-1 border-t-[0.5px] border-bg-border" />
    </div>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run tests/ui/TimeSeparator.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire timestamps into `ChatInterface.tsx`**

Add the `Fragment` import and `TimeSeparator` import at the top of `ChatInterface.tsx`:

```ts
import { useState, useEffect, useRef, useCallback, Fragment } from 'react'
import { TimeSeparator } from './TimeSeparator'
```

Add a helper function inside the module (outside the component):

```ts
function messageDateLabel(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const msgMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const diffDays = Math.round((todayMidnight - msgMidnight) / 86_400_000)
  if (diffDays === 0) return 'Vandaag'
  if (diffDays === 1) return 'Gisteren'
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
}
```

Update history mapping to include `created_at`:

```ts
        const loaded = (data.messages ?? []).map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          created_at: m.created_at,
        }))
```

Update the message list render to use `Fragment` + separators:

```tsx
        {messages.map((msg, i) => {
          const prev = i > 0 ? messages[i - 1] : null
          const showSeparator =
            msg.created_at != null &&
            (prev?.created_at == null ||
              new Date(msg.created_at).toDateString() !==
                new Date(prev.created_at).toDateString())
          return (
            <Fragment key={msg.id}>
              {showSeparator && (
                <TimeSeparator dateLabel={messageDateLabel(msg.created_at!)} />
              )}
              <ChatMessage
                role={msg.role}
                content={msg.content}
                timestamp={msg.created_at}
                cards={msg.cards}
              />
            </Fragment>
          )
        })}
```

- [ ] **Step 6: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/chat/TimeSeparator.tsx src/components/chat/ChatInterface.tsx tests/ui/TimeSeparator.test.tsx
git commit -m "feat(chat): add timestamps and day separators to message list"
```

---

### Task B2: ChatMessage timestamp rendering + aria-live + ChatInput a11y

**Files:**
- Modify: `src/components/chat/ChatInterface.tsx` (aria-live on message list)
- Modify: `src/components/chat/ChatInput.tsx` (remove autoFocus, add aria-label, focus-ring)

> `ChatMessage` already renders `<time>` via Task A4. This task wires the aria attributes and accessibility fixes.

**Interfaces:**
- Consumes: existing components.
- Produces: message list has `role="log"` + `aria-live="polite"` + `aria-label`; `ChatInput` textarea has `aria-label` and no `autoFocus`; input wrapper has `focus-within` ring.

- [ ] **Step 1: Add `role="log"` and `aria-live` to the scroll container in `ChatInterface.tsx`**

Find the scroll container div:

```tsx
      <div
        ref={scrollContainerRef}
        className={`flex-1 space-y-3 overflow-y-auto ${compact ? 'p-3' : 'p-4'}`}
      >
```

Replace with:

```tsx
      <div
        ref={scrollContainerRef}
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Gesprek"
        className={`flex-1 space-y-3 overflow-y-auto ${compact ? 'p-3' : 'p-4'}`}
      >
```

- [ ] **Step 2: Update `ChatInput.tsx`**

Replace the full file:

```tsx
'use client'

import { useState, useRef, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'

export interface ChatInputProps {
  onSend: (message: string) => void
  isLoading: boolean
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed || isLoading) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleInput() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  return (
    <div className="flex items-end gap-2 rounded-card-lg bg-bg-surface border-[0.5px] border-bg-border px-4 py-2 min-h-[44px] focus-within:ring-2 focus-within:ring-[var(--color-sport-gym-base)]/60 transition-shadow">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder="Stel een vraag of log een maaltijd..."
        aria-label="Bericht aan coach"
        rows={1}
        disabled={isLoading}
        enterKeyHint="send"
        className="flex-1 resize-none bg-transparent text-body text-text-primary outline-none placeholder:text-text-tertiary py-1.5"
        style={{ maxHeight: '160px' }}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!value.trim() || isLoading}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-150 active:scale-95 disabled:opacity-30 disabled:active:scale-100"
        style={{
          background: 'linear-gradient(135deg, #00E5C7, #7C3AED)',
          boxShadow: value.trim() && !isLoading ? '0 4px 16px -4px rgba(0,229,199,0.4)' : 'none',
        }}
        aria-label="Verstuur bericht"
      >
        {isLoading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <Send size={15} color="white" strokeWidth={2.5} />
        )}
      </button>
    </div>
  )
}
```

Note: `autoFocus` is removed (was on line 53 of the original). `aria-label="Bericht aan coach"` added. Focus-ring via `focus-within:ring-2` on the wrapper.

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/ChatInterface.tsx src/components/chat/ChatInput.tsx
git commit -m "fix(chat): aria-live on message list, remove autoFocus, add aria-label + focus-ring to input (UX-03, UX-04, UX-08)"
```

---

### Task B3: Credit-balance error detection

**Files:**
- Create: `src/lib/ai/chat/stream-errors.ts`
- Create: `tests/lib/chat/stream-errors.test.ts`
- Modify: `src/app/api/chat/route.ts` (import from new module)

**Interfaces:**
- Consumes: nothing new.
- Produces: `StreamErrorEvent` type with code `'AI_CREDIT_ERROR'`; `classifyStreamError` detects `credit balance` / `billing` strings in the provider error (mirrors `block-review/analyse/route.ts`).

- [ ] **Step 1: Write the failing test**

Create `tests/lib/chat/stream-errors.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { classifyStreamError } from '@/lib/ai/chat/stream-errors'

describe('classifyStreamError', () => {
  it('returns AI_CREDIT_ERROR when provider message contains "credit balance"', () => {
    const err = {
      name: 'AI_APICallError',
      statusCode: 400,
      message: 'Your credit balance is too low',
      responseBody: '',
    }
    const event = classifyStreamError(err)
    expect(event.code).toBe('AI_CREDIT_ERROR')
    expect(event.__error).toBe(true)
    expect(event.message).toContain('credits')
  })

  it('returns AI_CREDIT_ERROR when responseBody contains "billing"', () => {
    const err = {
      name: 'AI_APICallError',
      statusCode: 400,
      message: 'error',
      responseBody: '{"error":{"type":"billing_error","message":"billing issue"}}',
    }
    expect(classifyStreamError(err).code).toBe('AI_CREDIT_ERROR')
  })

  it('returns AI_AUTH_ERROR for 401', () => {
    const err = { name: 'AI_APICallError', statusCode: 401, message: 'unauthorized', responseBody: '' }
    expect(classifyStreamError(err).code).toBe('AI_AUTH_ERROR')
  })

  it('returns AI_RATE_LIMIT for 429', () => {
    const err = { name: 'AI_APICallError', statusCode: 429, message: 'rate limited', responseBody: '' }
    expect(classifyStreamError(err).code).toBe('AI_RATE_LIMIT')
  })

  it('returns AI_TIMEOUT for AbortError', () => {
    expect(classifyStreamError({ name: 'AbortError', statusCode: undefined, message: '' }).code).toBe('AI_TIMEOUT')
  })

  it('returns AI_TIMEOUT when message contains "timeout"', () => {
    expect(classifyStreamError({ name: 'other', message: 'request timeout' }).code).toBe('AI_TIMEOUT')
  })

  it('returns AI_GENERIC_ERROR as fallback', () => {
    expect(classifyStreamError({ name: 'unknown', message: 'oops' }).code).toBe('AI_GENERIC_ERROR')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/lib/chat/stream-errors.test.ts`
Expected: FAIL — cannot find module `@/lib/ai/chat/stream-errors`.

- [ ] **Step 3: Create `stream-errors.ts`**

Create `src/lib/ai/chat/stream-errors.ts`:

```ts
// ---------------------------------------------------------------------------
// Classifies raw provider errors into structured SSE error events.
// Extracted from src/app/api/chat/route.ts for testability (audit AI-03).
// Mirrors the credit-balance detection in block-review/analyse/route.ts.
// ---------------------------------------------------------------------------

export interface StreamErrorEvent {
  __error: true
  code:
    | 'AI_AUTH_ERROR'
    | 'AI_RATE_LIMIT'
    | 'AI_TIMEOUT'
    | 'AI_CREDIT_ERROR'
    | 'AI_GENERIC_ERROR'
  message: string
}

export function classifyStreamError(err: unknown): StreamErrorEvent {
  const e = err as {
    name?: string
    statusCode?: number
    message?: string
    responseBody?: string
  }

  if (e?.name === 'AI_APICallError') {
    const lowerMsg =
      (e.message ?? '').toLowerCase() + ' ' + (e.responseBody ?? '').toLowerCase()

    if (lowerMsg.includes('credit balance') || lowerMsg.includes('billing')) {
      return {
        __error: true,
        code: 'AI_CREDIT_ERROR',
        message:
          'De AI-coach kan tijdelijk niet bereikt worden — Anthropic credits zijn op. ' +
          'Voeg credits toe via console.anthropic.com en probeer opnieuw.',
      }
    }
    if (e.statusCode === 401 || e.statusCode === 403) {
      return {
        __error: true,
        code: 'AI_AUTH_ERROR',
        message:
          'AI is tijdelijk niet bereikbaar (auth-fout). Beheerder is gewaarschuwd — probeer het later opnieuw.',
      }
    }
    if (e.statusCode === 429) {
      return {
        __error: true,
        code: 'AI_RATE_LIMIT',
        message: 'Te veel verzoeken naar de AI. Probeer het over 30 seconden opnieuw.',
      }
    }
  }

  if (e?.name === 'AbortError' || /timeout/i.test(e?.message ?? '')) {
    return {
      __error: true,
      code: 'AI_TIMEOUT',
      message: 'AI-antwoord duurde te lang. Probeer een kortere vraag.',
    }
  }

  return {
    __error: true,
    code: 'AI_GENERIC_ERROR',
    message: 'Er ging iets mis bij het genereren van het antwoord. Probeer het opnieuw.',
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run tests/lib/chat/stream-errors.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Replace inline classifier in `route.ts` with import**

Remove the `interface StreamErrorEvent` block and the `function classifyStreamError` function from `route.ts`. Add the import:

```ts
import { classifyStreamError, type StreamErrorEvent } from '@/lib/ai/chat/stream-errors'
```

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/chat/stream-errors.ts src/app/api/chat/route.ts tests/lib/chat/stream-errors.test.ts
git commit -m "fix(chat): credit-balance error detection in chat stream; extract classifyStreamError (AI-03)"
```

---

## Phase C — Rich empty state + open-in-last-session

### Task C1: Rich empty hero + remove ChatSuggestions

**Files:**
- Modify: `src/components/chat/ChatInterface.tsx`
- Delete: `src/components/chat/ChatSuggestions.tsx`

**Interfaces:**
- Consumes: `CoachOrb` (already imported).
- Produces: `messages.length === 0 && !isLoading` renders a hero (CoachOrb + "Hoi Stef 👋" + subtitle). `ChatSuggestions` is removed. `showSuggestions` state removed.

- [ ] **Step 1: Update `ChatInterface.tsx`**

Remove the `ChatSuggestions` import and `showSuggestions` state. Replace the empty-state block and the `ChatSuggestions` render.

At the top, **remove**:
```ts
import { ChatSuggestions } from './ChatSuggestions'
```

**Remove** `showSuggestions` state declaration:
```ts
const [showSuggestions, setShowSuggestions] = useState(true)
```

**Remove** every `setShowSuggestions(...)` call (there are 2: one on line 52 inside `handleSend`, one in the history fetch callback).

Replace the empty-state JSX:

```tsx
        {/* BEFORE */}
        {messages.length === 0 && !isLoading && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-subhead text-text-tertiary">
              Stel een vraag of log een maaltijd
            </p>
          </div>
        )}

        {/* AFTER */}
        {messages.length === 0 && !isLoading && (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <CoachOrb size={64} state="idle" />
            <div>
              <p className="text-headline font-bold text-text-primary">Hoi Stef 👋</p>
              <p className="mt-1.5 text-body text-text-tertiary">
                Stel een vraag, log een maaltijd,
                <br />
                of stuur een foto via 📎
              </p>
            </div>
          </div>
        )}
```

Remove the `ChatSuggestions` render from the input bar area:

```tsx
        {/* REMOVE this line entirely: */}
        <ChatSuggestions onSelect={handleSend} visible={showSuggestions} />
```

- [ ] **Step 2: Delete `ChatSuggestions.tsx`**

```bash
git rm src/components/chat/ChatSuggestions.tsx
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS — no references to `ChatSuggestions` remain.

Run: `grep -rn "ChatSuggestions" src/`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/ChatInterface.tsx
git commit -m "feat(chat): rich empty hero state; remove ChatSuggestions (spec §3.3)"
```

---

### Task C2: `forceNew` prop + load-last-session-on-mount

**Files:**
- Modify: `src/components/chat/ChatInterface.tsx`
- Modify: `src/components/chat/ChatPage.tsx`

**Interfaces:**
- Consumes: existing history endpoint `GET /api/chat/history` (no session_id → returns last session).
- Produces: `ChatInterfaceProps.forceNew?: boolean` — when `true`, skip history fetch and show empty hero immediately (used by "Nieuwe chat" button). When `false` (default) and no `sessionId` prop and no `seededAssistant`, load the last session. `ChatPage` tracks `forceNew` state; resets on remount; passes it to `ChatInterface`.

- [ ] **Step 1: Update `ChatInterfaceProps` and `isFreshSession` initialisation**

In `src/components/chat/ChatInterface.tsx`, add `forceNew?: boolean` to `ChatInterfaceProps`:

```ts
export interface ChatInterfaceProps {
  sessionId?: string
  compact?: boolean
  initialMessage?: string
  seededAssistant?: string
  onLoadingChange?: (loading: boolean) => void
  onSessionCreated?: (sessionId: string) => void   // added here (used in Task D1)
  forceNew?: boolean
}
```

Change the `isFreshSession` initial state (currently `useState(!initialSessionId)`):

```ts
// BEFORE:
const [isFreshSession, setIsFreshSession] = useState(!initialSessionId)

// AFTER:
// forceNew=true  → always start fresh (Nieuwe chat button)
// seededAssistant → start fresh with seed (nudge first tap — don't load last session)
// default (neither) → load last/specified session
const [isFreshSession, setIsFreshSession] = useState(
  forceNew === true || !!seededAssistant,
)
```

Note: this change makes "open in last session" the default when navigating to the Coach tab without a seed. The history endpoint `GET /api/chat/history` (no session_id param) already returns the most recent session.

Also wire `onSessionCreated` in `handleSend` (set up for Task D1, harmless here):

Inside `handleSend`, after:
```ts
        if (newSessionId) {
          setSessionId(newSessionId)
          setIsFreshSession(false)
```

Add:
```ts
          onSessionCreated?.(newSessionId)
```

- [ ] **Step 2: Update `ChatPage.tsx`**

Add `forceNew` state and pass it to `ChatInterface`. Update `handleNewChat` to set `forceNew = true`:

```tsx
'use client'

import { useState, useCallback } from 'react'
import { SquarePen, Clock } from 'lucide-react'
import { ChatInterface } from './ChatInterface'
import { ChatHistoryPanel } from './ChatHistoryPanel'
import { CoachOrb } from '@/components/shared/CoachOrb'

interface ChatPageProps {
  initialMessage?: string
  seededAssistant?: string
  initialSessionId?: string
  signalId?: string
}

export function ChatPage({
  initialMessage,
  seededAssistant,
  initialSessionId,
  signalId,
}: ChatPageProps) {
  const [sessionKey, setSessionKey] = useState(0)
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(initialSessionId)
  const [forceNew, setForceNew] = useState(false)
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const handleNewChat = useCallback(() => {
    setForceNew(true)
    setActiveSessionId(undefined)
    setSessionKey((k) => k + 1)
  }, [])

  const handleSelectSession = useCallback((id: string) => {
    setForceNew(false)
    setActiveSessionId(id)
    setSessionKey((k) => k + 1)
  }, [])

  const handleSessionCreated = useCallback(
    (newSessionId: string) => {
      if (signalId && typeof window !== 'undefined') {
        window.localStorage.setItem(`pulse:nudgeSession:${signalId}`, newSessionId)
      }
    },
    [signalId],
  )

  return (
    <div className="flex h-[calc(100dvh-var(--nav-height))] flex-col lg:h-screen">
      <header
        className="sticky top-0 z-30 glass-nav border-b-[0.5px] border-bg-border pt-safe pl-safe pr-safe"
        style={{ background: 'linear-gradient(180deg, rgba(124,58,237,0.14) 0%, var(--color-bg-glass-nav) 100%)' }}
      >
        <div className="flex h-14 items-center gap-3 px-4">
          <CoachOrb size={40} />
          <div className="min-w-0 flex-1">
            <div className="text-[18px] font-bold leading-[22px] tracking-[-0.3px] text-text-primary">
              Pulse Coach
            </div>
            <div className="flex items-center gap-1.5 text-body-s text-status-good">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-good"
                style={{ boxShadow: '0 0 8px var(--color-status-good)' }}
              />
              Beschikbaar · kent al je data
            </div>
          </div>
          <button
            type="button"
            aria-label="Gesprekshistorie"
            onClick={() => setHistoryOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-text-secondary transition-all duration-150 hover:text-text-primary active:scale-95"
          >
            <Clock size={20} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="Nieuwe chat"
            disabled={isChatLoading}
            onClick={handleNewChat}
            className="flex h-11 w-11 items-center justify-center rounded-full text-text-secondary transition-all duration-150 hover:text-text-primary active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          >
            <SquarePen size={20} strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <ChatInterface
          key={sessionKey}
          sessionId={activeSessionId}
          forceNew={forceNew}
          initialMessage={initialMessage}
          seededAssistant={seededAssistant}
          onLoadingChange={setIsChatLoading}
          onSessionCreated={handleSessionCreated}
        />
      </div>

      <ChatHistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelect={handleSelectSession}
        onNewChat={handleNewChat}
      />
    </div>
  )
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/ChatInterface.tsx src/components/chat/ChatPage.tsx
git commit -m "feat(chat): open-in-last-session default + forceNew prop for Nieuwe chat (spec §3.2)"
```

> **Architecture note — home-header CoachOrb shortcut:** The CoachOrb button in the home header navigates to `/chat` and requires **no change**. After Phase C, a bare `/chat` mount auto-loads the last session via `forceNew=false` (the new default). The "Nieuwe chat" (pencil/SquarePen) button in the chat header remains the only entry point for starting a fresh chat.

---

## Phase D — Entry polish

### Task D1: UX-09 CoachCard session anchoring

**Files:**
- Modify: `src/components/dashboard/v2/CoachCard.tsx`
- Modify: `src/app/(app)/chat/page.tsx`

**Interfaces:**
- Consumes: `localStorage` key `pulse:nudgeSession:${signalId}`; `ChatPage` `signalId` + `initialSessionId` props (wired in Task C2).
- Produces: CoachCard checks for a stored session before navigating; if found, opens `/chat?session_id=${id}`; if not found, opens `/chat?seed=${text}&signal=${signalId}`. Chat page server component reads `session_id` and `signal` params and passes to `ChatPage`. `ChatPage.handleSessionCreated` (Task C2) persists the new session to localStorage.

- [ ] **Step 1: Update `CoachCard.tsx`**

Replace the `openChat` callback:

```ts
  const NUDGE_SESSION_PREFIX = 'pulse:nudgeSession:'

  const openChat = useCallback(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(NUDGE_SESSION_PREFIX + signalId)
      if (stored) {
        router.push(`/chat?session_id=${encodeURIComponent(stored)}`)
        return
      }
    }
    router.push(`/chat?seed=${encodeURIComponent(text)}&signal=${encodeURIComponent(signalId)}`)
  }, [router, text, signalId])
```

- [ ] **Step 2: Update `src/app/(app)/chat/page.tsx`**

Add `session_id` and `signal` to the `Props` interface and pass them to `ChatPage`:

```tsx
import { ChatPage } from '@/components/chat/ChatPage'

interface Props {
  searchParams: Promise<{
    context?: string
    name?: string
    workout?: string
    seed?: string
    session_id?: string
    signal?: string
  }>
}

export default async function ChatRoute({ searchParams }: Props) {
  const params = await searchParams
  let initialMessage: string | undefined
  let seededAssistant: string | undefined

  if (params.seed) {
    seededAssistant = params.seed
  } else if (params.context === 'exercise' && params.name) {
    const exercise = decodeURIComponent(params.name)
    const workout = params.workout ? decodeURIComponent(params.workout) : null
    initialMessage = workout
      ? `Ik wil meer weten over ${exercise} (${workout}). Wat zijn de belangrijkste techniektips en hoe bouw ik progressie op?`
      : `Ik wil meer weten over ${exercise}. Wat zijn de belangrijkste techniektips en hoe bouw ik progressie op?`
  }

  return (
    <ChatPage
      initialMessage={initialMessage}
      seededAssistant={seededAssistant}
      initialSessionId={params.session_id}
      signalId={params.signal}
    />
  )
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS.

Run: `grep -n "openChat" src/components/dashboard/v2/CoachCard.tsx`
Expected: shows the updated function with the localStorage check.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/v2/CoachCard.tsx src/app/\(app\)/chat/page.tsx
git commit -m "feat(chat): UX-09 nudge session anchoring — CoachCard resumes stored session per signalId"
```

---

### Task D2: AI-01 — `after()` for fire-and-forget extractors

> This task is already done as part of Task A2 (Step 5). The `after()` calls for `extractAndUpdateMemory` and `runBeliefExtractor` were added in Task A2 when the route was updated for `__card` SSE emission. No additional work needed here.

Verify:

Run: `grep -n "after(" src/app/api/chat/route.ts`
Expected: two `after(async () => {` calls are present (for `extractAndUpdateMemory` and `runBeliefExtractor`).

If Task A2 was completed correctly this is already done. If for any reason it was skipped, apply the `after()` change from Task A2's Step 5 now.

- [ ] **Step 1: Verify `after()` is used**

```bash
grep -n "after(" src/app/api/chat/route.ts
```

Expected output (two lines):
```
371:            after(async () => {
376:            after(async () => {
```

If missing, apply the change from Task A2 Step 5. Then commit:

```bash
git add src/app/api/chat/route.ts
git commit -m "fix(chat): AI-01 wrap fire-and-forget extractors in after() for Vercel survival"
```

---

## Self-Review

### 1. Spec coverage

| Audit ref | Spec section | Covered in |
|---|---|---|
| UX-02 write-back confirmation | §3.4 | Tasks A2, A3, A4 |
| UX-03 aria-live | §3.3 | Task B2 |
| UX-04 input aria-label | §3.3 | Task B2 |
| UX-08 autoFocus removal | §3.3 | Task B2 |
| UX-09 session continuity | §3.1 | Tasks C2, D1 |
| AI-01 after() extractors | §4 | Task A2 (D2 verifies) |
| AI-03 credit-balance error | §3.3 | Task B3 |
| Informational cards | §3.4 | Tasks A1–A4 |
| Open-in-last-session | §3.2 | Task C2 |
| Rich empty hero | §3.3 | Task C1 |
| Time-separators | §3.3 | Task B1 |
| Card-tag contract in system prompt | §3.4 | Task A4 |
| Chat-suggestions API + hook removal | — | Task A5 |

**Out of scope (Plan 3):** `§3.5` photo attachments, `POST /api/chat/attachments`, `chat-attachments` migration, multimodal image blocks.

### 2. Placeholder scan

- No `// TBD`, `// TODO`, `// add error handling`, or `similar to above` in any code step.
- Playwright spec has minimal assertions with a note that full assertion requires a test-env seed. This is a real constraint (not a placeholder) because `.env.local` = prod.

### 3. Type consistency

- `AnyCard` (discriminated union) is defined in `cards.ts` and consumed by `ChatInterface` (SSE parse), `ChatMessage` (render), `CardRenderer` (dispatch), and `route.ts` (emit).
- `WritebackCardData` is returned by `makeWritebackCard` and stored in `WritebackOutcome.card`. Type flows from `writebacks.ts` → `route.ts` → SSE → `ChatInterface` → `ChatMessage`.
- `ChatMessageProps.cards?: AnyCard[]` matches `Message.cards?: AnyCard[]` in `ChatInterface`.
- `ChatInterfaceProps.forceNew?: boolean` is defined in `ChatInterface` and consumed by `ChatPage`. `ChatPage` defaults `forceNew` to `false`; sets `true` on "Nieuwe chat".
- `ChatPageProps.initialSessionId?: string` and `signalId?: string` are defined and consumed by `ChatPage` → passed to `ChatInterface` (`sessionId`) and the localStorage callback.
- `StreamErrorEvent.code` now includes `'AI_CREDIT_ERROR'`; `classifyStreamError` is tested against all 5 codes.
- The `isFreshSession` initialisation `forceNew === true || !!seededAssistant` is a `boolean` expression — correct.

### 4. Ordering constraints

Tasks must be applied in phase order. Within a phase, tasks are independent **except**:
- A4 requires A1 (imports `AnyCard`/`AnyCardSchema`) and A3 (imports `CardRenderer`).
- C2 requires C1 (both modify `ChatInterface`).
- D1 requires C2 (`signalId` prop and `handleSessionCreated` already exist in `ChatPage`).
- D2 is already done in A2; only verification is needed.
- A5 requires C1 (C1 deletes `ChatSuggestions.tsx` and removes its imports; A5 handles the remaining API route + hook cleanup). Although labelled Phase A, run A5 after C1.

### 5. Database note

No migrations in Plan 2. The `Message.created_at` field comes from the existing `chat_messages.created_at` column (already selected in the history route) — no schema changes needed.
