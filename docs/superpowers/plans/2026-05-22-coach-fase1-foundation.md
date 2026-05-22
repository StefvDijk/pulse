# Coach Brains — Fase 1: Foundation + Acute Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify Pulse's coach-AI under one shared `coach-core` (persona + knowledge + memory-read), refactor the block-review wizard to use system/user splitting with prompt-caching + marker-fallback to fix the empty-response bug, and wire a `<cited_memories>` write-back so the coach actively refreshes the memory he uses.

**Architecture:** New module `src/lib/ai/coach-core.ts` exports three pure builder functions consumed by both chat-system and block-review prompts. Block-review route migrates to the existing `streamChat()` helper (which already supports ephemeral cache-control on the system message). The coach gains a `<cited_memories>id1,id2</cited_memories>` write-back tag that the chat route strips and uses to call existing `confirmMemory()`.

**Tech Stack:** Next.js 14 App Router · TypeScript · Anthropic SDK via Vercel AI SDK v6 (`@ai-sdk/anthropic` + `ai`) · Supabase · Vitest. Sonnet 4.6 for all coach surfaces.

**Spec:** `docs/superpowers/specs/2026-05-22-coach-brains-design.md` — Fase 1 deliverables.

---

## File map (what gets created / touched)

**Create:**
- `src/lib/ai/coach-core.ts` — shared persona/knowledge/memory builders
- `tests/lib/ai/coach-core.test.ts` — unit tests for builders
- `tests/lib/ai/block-review-prompt.test.ts` — verifies {system, user} split
- `tests/lib/ai/chat-system-prompt.test.ts` — verifies coach-core integration

**Modify:**
- `src/lib/ai/context-assembler.ts` (loadCoachingMemory @ 864-892) — include memory id in output
- `src/lib/ai/prompts/block-review.ts` — `buildBlockReviewPrompt` returns `{ system, user }` instead of `string`
- `src/app/api/block-review/analyse/route.ts` — use `streamChat()` + marker fallback
- `src/lib/ai/prompts/chat-system.ts` — replace `TONE_BLOCKS` with coach-core persona + knowledge
- `src/app/api/chat/route.ts` — `extractWritebacks` parses `<cited_memories>`; route calls `confirmMemory()` per id
- `src/components/block-review/steps/AnalysisStep.tsx` (no code change expected — verify it still works against the new route)

---

## Test strategy

- Unit-test all builders with content assertions ("the persona text contains 'cijfer-eerst'", "knowledge base mentions ACWR 0.8-1.3"). Snapshot tests are brittle — prefer keyword/section assertions.
- Prompt-builder refactors are pure functions — fully unit-testable.
- Route changes are verified end-to-end via the dev server in Task 9.
- Run `pnpm test` after each task. Tests must stay green.

---

## Task 1: Scaffold `coach-core` with `buildCoachPersona()`

**Files:**
- Create: `src/lib/ai/coach-core.ts`
- Create: `tests/lib/ai/coach-core.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/ai/coach-core.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildCoachPersona } from '@/lib/ai/coach-core'

describe('buildCoachPersona', () => {
  it('declares the coach identity as expert, not pedagogue', () => {
    const text = buildCoachPersona()
    expect(text).toMatch(/wijze expert/i)
    expect(text).not.toMatch(/socrat/i)
  })

  it('includes the four core behaviours by name', () => {
    const text = buildCoachPersona()
    expect(text).toMatch(/cijfer-eerst/i)
    expect(text).toMatch(/memory-actief/i)
    expect(text).toMatch(/eerlijk waar het telt/i)
    expect(text).toMatch(/prestatie-erkenning/i)
  })

  it('forbids hype and filler explicitly', () => {
    const text = buildCoachPersona()
    expect(text).toMatch(/geen filler|geen hype|geen "great question/i)
  })

  it('allows measured praise like "goed gedaan" with constraints', () => {
    const text = buildCoachPersona()
    expect(text).toMatch(/goed gedaan/i)
    expect(text).toMatch(/niet bij elke beurt|bewaart kracht/i)
  })

  it('states explicit limits (no diagnosis, no caloriedoelen <1800)', () => {
    const text = buildCoachPersona()
    expect(text).toMatch(/geen diagnose/i)
    expect(text).toMatch(/1800 kcal/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/ai/coach-core.test.ts`
Expected: FAIL — module `@/lib/ai/coach-core` does not exist.

- [ ] **Step 3: Implement `coach-core.ts` with `buildCoachPersona()`**

Create `src/lib/ai/coach-core.ts`:

```typescript
// ---------------------------------------------------------------------------
// coach-core — shared persona, knowledge base, and memory-read builder
// consumed by every coach surface (chat, block-review, weekly check-in).
//
// Design source: docs/superpowers/specs/2026-05-22-coach-brains-design.md
// ---------------------------------------------------------------------------

/**
 * The coach's identity and voice — sectie 1 of the design spec.
 * Returns a markdown-flavoured fragment intended to be embedded in a
 * system prompt above any surface-specific werkwijze.
 */
export function buildCoachPersona(): string {
  return `## WIE JE BENT

Je bent Stefs coach: de wijze expert in zijn broekzak. Diepe evidence-based kennis (Schoenfeld, Israetel, Helms, McGill, Wulf), tientallen jaren ervaring impliciet. Type top-PT die hij belt wanneer hij iets wil weten. Je bent er niet om Stef tot een betere coach van zichzelf te maken — je bent er omdat jij het beste antwoord hebt. Geen Socratische pedagoog, geen scherpe peer, geen jolige vriend.

## HOE JE PRAAT

- Nederlands, "je"-vorm. Volwassen toon. Niet formeel, niet kameraadschappelijk.
- Kalm gezag. Geen hype, geen sarcasme, geen droge grappen, geen "great question!"-filler. Geen aanmoediging die hol is.
- Cijfers leiden. "Je bench staat 3 weken stil op e1RM 92kg" niet "ik denk dat je misschien stagneert".
- Directe antwoorden. Vraag krijgt antwoord. Geen "wat denk je zelf?" tenzij je echt iets niet weet uit de data.
- Onderbouwing kort. Eén zin waarom, niet drie.
- Geen lijsten van 5+ items. Max 3 bullets of volzinnen.
- Lengte naar context. Chat 3-8 zinnen meestal. Diepe analyse waar nodig — niet vermijden uit angst voor te lang.

## VIER KERNGEDRAGINGEN

1. **Cijfer-eerst.** Refereer per substantieel antwoord aan minimaal één concrete waarde uit Stefs data.
2. **Memory-actief.** Refereer aan minimaal 1 specifiek feit uit zijn geheugen wanneer relevant ("Vorige maand schreef je dat je knie zeurde na trap-lopen — actief nu?"). Anti-amnesie. Wanneer je citeert, eindig je antwoord met \`<cited_memories>id1,id2</cited_memories>\` zodat de app weet welke memories je gebruikt hebt.
3. **Eerlijk waar het telt.** Bij echte risico's (overtraining-signalen, blessure-flares, gevaarlijke calorie-deficit, snel switchen tussen blokken) zeg je wat je ziet en wat het betekent. Geen challenge bij elke request — alleen wanneer er evidence van risico is.
4. **Prestatie-erkenning op basis van data.** Bij belangrijke momenten benoem je wat Stef heeft opgebouwd — niet als "wow goed bezig" maar als observatie met gewicht. "Goed gedaan" of "knap" mag, mits aansluitend bij iets concreets en niet bij elke beurt. Bewaart kracht.
   - Voorbeeld: *"11 van 12 weken raak. Knap gedaan — dat haalt bijna niemand."*
   - Niet: *"Goed gedaan met je log!"* na elke voedingsregel.

## WAT JE NIET DOET

- Geen Socratische tegenvragen als standaard.
- Geen "opleidende" toon.
- Geen sarcasme, geen humor.
- Geen filler ("ik hoop dat dit helpt", "succes!", "you got this").
- Geen yes-man, maar ook geen confront-bot.

## JE BEPERKINGEN, EXPLICIET

- Geen diagnose. Bij pijn >7 dagen → adviseer fysio.
- Geen medicatie of zware supplementen-adviezen.
- Geen caloriedoelen onder 1800 kcal zonder medische supervisie.
- Techniek-correctie alleen op basis van wat Stef zelf beschrijft.
- Erken wanneer iets niet uit data komt: "Dat zie ik niet in je data. Wat zie jij?"`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/lib/ai/coach-core.test.ts`
Expected: PASS — all 5 assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/coach-core.ts tests/lib/ai/coach-core.test.ts
git commit -m "feat(coach-core): scaffold persona builder with four core behaviours"
```

---

## Task 2: Add `buildKnowledgeBase()` to coach-core

**Files:**
- Modify: `src/lib/ai/coach-core.ts`
- Modify: `tests/lib/ai/coach-core.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/lib/ai/coach-core.test.ts`:

```typescript
import { buildKnowledgeBase } from '@/lib/ai/coach-core'

describe('buildKnowledgeBase', () => {
  it('includes Israetel volume landmarks (MV/MEV/MAV/MRV)', () => {
    const text = buildKnowledgeBase()
    expect(text).toMatch(/MV.*MEV.*MAV.*MRV/i)
  })

  it('includes ACWR safety band 0.8-1.3', () => {
    const text = buildKnowledgeBase()
    expect(text).toMatch(/ACWR/i)
    expect(text).toMatch(/0\.8.*1\.3/)
  })

  it('includes rep-ranges per training goal', () => {
    const text = buildKnowledgeBase()
    expect(text).toMatch(/kracht.*1-5 reps/i)
    expect(text).toMatch(/hypertrofie.*6-12|hypertrofie.*8-12/i)
  })

  it('includes protein target range per kg LBM', () => {
    const text = buildKnowledgeBase()
    expect(text).toMatch(/1\.6.*2\.2 ?g\/kg|2\.2 ?g\/kg/i)
  })

  it('mentions interferentie-effect for concurrent training', () => {
    const text = buildKnowledgeBase()
    expect(text).toMatch(/interferentie/i)
  })

  it('mentions deload cadence 3-5 weeks', () => {
    const text = buildKnowledgeBase()
    expect(text).toMatch(/deload.*3-?5 weken|deload.*elke 3-?4|3-?4 weken/i)
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test tests/lib/ai/coach-core.test.ts`
Expected: FAIL — `buildKnowledgeBase` is not exported.

- [ ] **Step 3: Implement `buildKnowledgeBase()`**

Append to `src/lib/ai/coach-core.ts`:

```typescript
/**
 * Evidence-based knowledge base — the principles the coach reasons with.
 * Sources: Schoenfeld/Israetel meta-analyses, Helms pyramids, McGill back
 * protocols, Wulf attentional-focus literature, ACWR injury research.
 */
export function buildKnowledgeBase(): string {
  return `## EVIDENCE-BASED KENNIS

Je redeneert vanuit deze principes:

### Periodisatie
Linear (beginners), DUP / weekly undulating (intermediates), block / conjugate (advanced). Beginners (< 12 maanden serieus trainen) doen het beste op double progression of linear. Deload elke 3-4 weken (verlaag volume 40-50%, of intensiteit, niet beide).

### Hypertrofie-volume (Israetel)
Volume-landmarks per spiergroep per week: **MV** (maintenance) → **MEV** (minimum effective) → **MAV** (max adaptive) → **MRV** (max recoverable). Quads ~12-20 sets/week, chest ~10-20, back ~14-22 zijn ballpark. Frequency 2× per spiergroep per week is meestal optimaal voor hypertrofie.

### Rep-ranges per doel
- **Kracht primair**: 1-5 reps @ 85-95% 1RM, RPE 7-9, rust 3-5 min op compound
- **Hypertrofie compound**: 5-8 reps @ 75-85%, RPE 7-9, rust 2-3 min
- **Hypertrofie isolatie**: 8-15 reps @ 60-75%, RPE 7-10, rust 60-90s
- **Endurance**: 15-25 reps @ 50-65%, RPE 6-8, rust 30-60s

### Progressive overload
- **Double progression**: voltooi rep-bovengrens met goede vorm, +2.5kg next session
- **RPE-autoregulatie**: target RPE, gewicht aanpassen op gevoel (Helms/Tuchscherer)
- **%1RM-cycling**: vaste percentages per week op een 4-6 weken cyclus

### Recovery & frequency
48u tussen zelfde spiergroep voor hypertrofie. 72u na zware compound (squat/deadlift). Slaap < 7u → volume 10-20% verlagen of intensiteit terugbrengen.

### Voeding (Helms hierarchy)
1. **Eiwit 1.6-2.2 g/kg LBM** bij krachttraining-fase. Bij body recomp target 2.2g/kg.
2. **Caloriebalans**: lean recomp (kleine surplus 5-10%) of mild deficit (10-20%) voor 3-12 maanden trainenden.
3. **Peri-workout**: 20-40g eiwit ~1-2u voor sessie, 20-40g binnen 2u erna.
4. **Hydratatie** 35ml/kg + 500-1000ml extra per intensieve uur.

### Hardlopen + krachttraining (concurrent training)
- **ACWR** (acute:chronic workload ratio) houden tussen **0.8-1.3** om blessure-risico te beperken.
- **Polarisatie**: 80% easy / 20% hard (Z2 vs Z4-5).
- **Interferentie-effect**: krachttraining op dag X, easy run kan zelfde dag (≥6u apart), zware run NIET dezelfde dag als zware legday.
- Bij verhoogde run-load: keep heavy compounds, drop accessory volume eerst.

### Coaching cues (Wulf)
Externe focus ("push the floor away") leert sneller en presteert beter dan interne focus ("squeeze your quads") op compounds. Interne focus alleen relevant bij isolatie-werk voor mind-muscle connection.

### Blessure-management & RTP
- Pijn-schaal: 0-3 acceptabel, 4-6 reduceer volume, 7+ stop.
- Load management trumps technique cues bij re-flare.
- Asymmetrieën: unilateral work voor de zwakke kant +1 set, niet -1 op de sterke.
- McGill big 3 (curl-up, side bridge, bird dog) als rug-prehab.`
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `pnpm test tests/lib/ai/coach-core.test.ts`
Expected: PASS — all 11 assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/coach-core.ts tests/lib/ai/coach-core.test.ts
git commit -m "feat(coach-core): add evidence-based knowledge base builder"
```

---

## Task 3: Expose memory ids in `loadCoachingMemory`

The coach can only cite memories by id if the loader emits them. Currently `src/lib/ai/context-assembler.ts:864-892` selects `category, key, value, source_date` and outputs `• {value}` lines with no id. We add `id` to the select and prefix each line with `[id:abc12345]` (first 8 chars of UUID for readability).

**Files:**
- Modify: `src/lib/ai/context-assembler.ts:864-892`

- [ ] **Step 1: Read current implementation to confirm shape**

Read `src/lib/ai/context-assembler.ts` lines 864-892. Confirm it matches the snapshot used in this plan (select fields = category, key, value, source_date; output uses bullet lines).

- [ ] **Step 2: Update select + output format**

Replace the body of `loadCoachingMemory` in `src/lib/ai/context-assembler.ts`:

```typescript
async function loadCoachingMemory(userId: string): Promise<string | null> {
  const supabase = createAdminClient()
  // [B5] Cap at 30 most-recent memories: prevents the memory table (which
  // grows unbounded over months) from inflating every chat-request's context.
  const { data } = await supabase
    .from('coaching_memory')
    .select('id, category, key, value, source_date')
    .eq('user_id', userId)
    .is('superseded_by', null)
    .gte('confidence', 0.3)
    .order('updated_at', { ascending: false })
    .limit(30)

  if (!data || data.length === 0) return null

  const byCategory: Record<string, Array<{ id: string; value: string }>> = {}
  for (const m of data) {
    if (!byCategory[m.category]) byCategory[m.category] = []
    byCategory[m.category].push({ id: m.id, value: m.value })
  }

  const lines: string[] = []
  for (const [cat, items] of Object.entries(byCategory)) {
    lines.push(`${cat.toUpperCase()}:`)
    for (const it of items) {
      const shortId = it.id.slice(0, 8)
      lines.push(`  • [id:${shortId}] ${it.value}`)
    }
  }

  return ['--- COACHING GEHEUGEN ---', ...lines].join('\n')
}
```

- [ ] **Step 3: Run existing tests + typecheck**

Run: `pnpm test && pnpm tsc --noEmit`
Expected: PASS — no test references this function shape directly; typecheck clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/context-assembler.ts
git commit -m "feat(coach): expose memory id in coaching-memory loader output"
```

---

## Task 4: Add `buildMemoryReadBlock()` to coach-core

Reads `coaching_memory` (via the loader from Task 3) and emits a structured prompt block. In fase 1 this is semantic + episodic; the beliefs slot is a placeholder for fase 2.

**Files:**
- Modify: `src/lib/ai/coach-core.ts`
- Modify: `tests/lib/ai/coach-core.test.ts`

- [ ] **Step 1: Add failing test**

Append to `tests/lib/ai/coach-core.test.ts`:

```typescript
import { buildMemoryReadBlock } from '@/lib/ai/coach-core'
import { vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
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
                      value: 'Stef traint het liefst \'s ochtends',
                    },
                  ],
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  }),
}))

describe('buildMemoryReadBlock', () => {
  it('returns a memory block with category headings and id-tagged lines', async () => {
    const block = await buildMemoryReadBlock('user-123')
    expect(block).toMatch(/MIJN GEHEUGEN OVER JOU/i)
    expect(block).toMatch(/PREFERENCE/i)
    expect(block).toMatch(/\[id:11111111\]/)
    expect(block).toMatch(/'s ochtends/)
  })

  it('returns an empty marker when no memories exist', async () => {
    // Re-mock to return empty
    const { createAdminClient } = await import('@/lib/supabase/admin')
    vi.mocked(createAdminClient).mockReturnValueOnce({
      from: () => ({
        select: () => ({
          eq: () => ({
            is: () => ({
              gte: () => ({
                order: () => ({
                  limit: async () => ({ data: [] }),
                }),
              }),
            }),
          }),
        }),
      }),
    } as never)
    const block = await buildMemoryReadBlock('user-empty')
    expect(block).toMatch(/nog geen geheugen|geen memories/i)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm test tests/lib/ai/coach-core.test.ts`
Expected: FAIL — `buildMemoryReadBlock` not exported.

- [ ] **Step 3: Implement `buildMemoryReadBlock()`**

Append to `src/lib/ai/coach-core.ts`:

```typescript
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Read the coach's memory of the user as a structured prompt block.
 * In fase 1 covers semantic + episodic (via coaching_memory).
 * Beliefs (procedural layer) wordt toegevoegd in fase 2.
 */
export async function buildMemoryReadBlock(userId: string): Promise<string> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('coaching_memory')
    .select('id, category, value')
    .eq('user_id', userId)
    .is('superseded_by', null)
    .gte('confidence', 0.3)
    .order('updated_at', { ascending: false })
    .limit(30)

  if (!data || data.length === 0) {
    return '## MIJN GEHEUGEN OVER JOU\n\n(Nog geen geheugen opgebouwd — leer Stef nog kennen.)'
  }

  const byCategory: Record<string, Array<{ id: string; value: string }>> = {}
  for (const row of data) {
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

  return lines.join('\n')
}
```

Note: the helper queries on its own (independent of `loadCoachingMemory`) because it needs full UUIDs in memory, not just first-8 prefixes. Keeping the two queries separate avoids parsing-back-out of the loader's pretty-printed string.

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm test tests/lib/ai/coach-core.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/coach-core.ts tests/lib/ai/coach-core.test.ts
git commit -m "feat(coach-core): add buildMemoryReadBlock with cited-memories instruction"
```

---

## Task 5: Refactor `buildBlockReviewPrompt` to return `{ system, user }`

This is the **acute fix** for the lege-response-bug. Currently `src/lib/ai/prompts/block-review.ts:138-349` returns one giant concatenated string that `route.ts` shoves into `messages`. We split it so persona+knowledge+werkwijze become the cacheable `system`, and per-turn data + transcript become `user`.

**Files:**
- Modify: `src/lib/ai/prompts/block-review.ts`
- Create: `tests/lib/ai/block-review-prompt.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/lib/ai/block-review-prompt.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildBlockReviewPrompt } from '@/lib/ai/prompts/block-review'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { BlockReviewFormState } from '@/components/block-review/types'

const minimalData: BlockReviewData = {
  schema: {
    id: 'schema-1',
    title: 'Test Schema',
    schemaType: 'upper_lower',
    weeksPlanned: 8,
    workoutsPerWeek: 4,
    startDate: '2026-03-01',
    endDate: '2026-04-26',
  },
  totals: {
    completedSessions: 28,
    plannedSessions: 32,
    adherencePct: 87,
    gymSessions: 28,
    runs: 6,
    runKm: 42,
    padelSessions: 2,
    totalTonnageKg: 82000,
  },
  templateAdherence: [],
  exerciseProgressions: [],
  bodyDelta: {
    weightKg: 80,
    skeletalMuscleMassKg: 38,
    fatMassKg: 12,
    fatPct: 15,
  },
  wellnessAverages: { feeling: 4, sleepQuality: 3.8, checkinCount: 12 },
  injuries: [],
  goals: [],
  journey: {
    journeyStart: '2026-02-01',
    daysActive: 110,
    lifetimeTotals: {
      totalWorkouts: 50,
      totalRuns: 12,
      totalRunKm: 85,
      totalPadelSessions: 4,
      totalTonnageKg: 150000,
    },
    priorSchemas: [],
    bodyJourney: [],
    bodyBaselineToNow: {
      weightKgDelta: null,
      skeletalMuscleMassKgDelta: null,
      fatMassKgDelta: null,
      fatPctDelta: null,
      waistCmDelta: null,
    },
    liftJourney: [],
    lifetimePRs: [],
    coachingMemory: [],
    weeklyLessons: [],
    recentWeeklyReviews: [],
    userProfile: null,
    customInstructions: null,
    proteinTargetPerKg: null,
    coachTone: null,
  },
} as BlockReviewData

const minimalForm: BlockReviewFormState = {
  reflection: {
    templateRatings: [],
    keepExercises: [],
    dropExercises: [],
    biggestWin: '',
    biggestMiss: '',
    injuryUpdates: {},
  },
  newInBody: null,
  conversation: [],
  aiAnalysis: '',
  aiSchemaProposal: null,
  schemaProposalVersion: 0,
  selectedGoals: [],
  endReason: 'completed',
}

describe('buildBlockReviewPrompt', () => {
  it('returns an object with system and user strings', () => {
    const result = buildBlockReviewPrompt({
      data: minimalData,
      form: minimalForm,
      conversation: [],
    })
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
    expect(result.system.length).toBeGreaterThan(500)
    expect(result.user.length).toBeGreaterThan(100)
  })

  it('puts coach-core persona + knowledge + werkwijze in system', () => {
    const { system } = buildBlockReviewPrompt({
      data: minimalData,
      form: minimalForm,
      conversation: [],
    })
    expect(system).toMatch(/wijze expert/i)        // persona
    expect(system).toMatch(/MEV.*MAV.*MRV/i)        // knowledge
    expect(system).toMatch(/\[NU VRAGEN\]/)         // werkwijze
    expect(system).toMatch(/block_proposal/i)       // werkwijze
  })

  it('puts journey + dit-blok + reflectie + transcript in user', () => {
    const { user } = buildBlockReviewPrompt({
      data: minimalData,
      form: minimalForm,
      conversation: [{ role: 'user', content: 'hoi' }],
    })
    expect(user).toMatch(/JOURNEY/i)
    expect(user).toMatch(/DIT BLOK/i)
    expect(user).toMatch(/REFLECTIE/i)
    expect(user).toMatch(/hoi/)                     // transcript present
  })

  it('first-turn user block signals geen gesprek yet', () => {
    const { user } = buildBlockReviewPrompt({
      data: minimalData,
      form: minimalForm,
      conversation: [],
    })
    expect(user).toMatch(/eerste beurt|nog geen gesprek/i)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm test tests/lib/ai/block-review-prompt.test.ts`
Expected: FAIL — current `buildBlockReviewPrompt` returns `string`, not `{ system, user }`.

- [ ] **Step 3: Refactor `buildBlockReviewPrompt` to return `{ system, user }`**

Open `src/lib/ai/prompts/block-review.ts`. Keep all the helper functions (`formatJsonOrSkip`, `buildJourneyBlock`) unchanged. Replace the bottom-of-file `buildBlockReviewPrompt` export with:

```typescript
export interface BlockReviewPrompt {
  system: string
  user: string
}

export function buildBlockReviewPrompt({
  data,
  form,
  conversation,
}: BuildBlockReviewPromptParams): BlockReviewPrompt {
  // -- per-call dynamic content (varies per turn) -----------------------------
  const ratings = form.reflection.templateRatings
    .map((t) => `- ${t.focus}: ${t.rating ?? '—'}${t.note ? ` ("${t.note}")` : ''}`)
    .join('\n')

  const currentExercises = data.exerciseProgressions
    .slice(0, 20)
    .map(
      (e) =>
        `- ${e.exerciseName}: e1RM ${e.startTopE1rm ?? '?'}→${e.endTopE1rm ?? '?'}kg (${
          e.deltaE1rmKg !== null ? (e.deltaE1rmKg >= 0 ? '+' : '') + e.deltaE1rmKg : '?'
        }kg)${e.stagnant ? ' [stagnant]' : ''}`,
    )
    .join('\n')

  const body = data.bodyDelta
  const bodyLine = `Gewicht ${body.weightKg ?? '?'}kg · Spiermassa ${body.skeletalMuscleMassKg ?? '?'}kg · Vetmassa ${body.fatMassKg ?? '?'}kg · Vet% ${body.fatPct ?? '?'}%`

  const injuries = data.injuries.map((i) => `- ${i.bodyLocation} (${i.severity}, ${i.status})`).join('\n')
  const goals = data.goals
    .map((g) => `- ${g.title}${g.targetValue ? ` (target ${g.targetValue}${g.targetUnit ?? ''})` : ''}`)
    .join('\n')

  const journeyBlock = buildJourneyBlock(data)

  const ditBlokSection = `# DIT BLOK (laatste ${data.schema.weeksPlanned} weken)

## Schema
${data.schema.title} (${data.schema.schemaType}, ${data.schema.weeksPlanned} weken, ${data.schema.workoutsPerWeek}×/week)
Periode: ${data.schema.startDate} → ${data.schema.endDate}

## Adherence
${data.totals.completedSessions}/${data.totals.plannedSessions} sessies (${data.totals.adherencePct ?? '?'}%)
Gym: ${data.totals.gymSessions} · Hardloop: ${data.totals.runs}× / ${data.totals.runKm}km · Padel: ${data.totals.padelSessions}×
Tonnage: ${data.totals.totalTonnageKg.toLocaleString('nl-NL')}kg

## Per workout template
${data.templateAdherence.map((t) => `- ${t.focus}: ${t.completed}/${t.planned} (${t.adherencePct ?? '?'}%)`).join('\n')}

## Oefening-progressie (top 20 op delta)
${currentExercises || '(geen progressie-data)'}

## Lichaamsverandering dit blok
${bodyLine}

## Wellness-gemiddelde dit blok
Energie ${data.wellnessAverages.feeling ?? '?'}/5 · Slaap-kwaliteit ${data.wellnessAverages.sleepQuality ?? '?'}/5 (n=${data.wellnessAverages.checkinCount} check-ins)

## Actieve blessures
${injuries || '(geen)'}

## Actieve doelen
${goals || '(geen)'}`

  const reflectieSection = `# STEFS REFLECTIE OP DIT BLOK

## Per workout
${ratings || '(geen ratings ingevuld)'}

## Behouden
${form.reflection.keepExercises.join(', ') || '(geen)'}

## Weg / vervangen
${form.reflection.dropExercises.join(', ') || '(geen)'}

## Grootste win
${form.reflection.biggestWin || '(niet ingevuld)'}

## Grootste tegenvaller
${form.reflection.biggestMiss || '(niet ingevuld)'}`

  const transcript =
    conversation.length === 0
      ? '\n\n# DIT IS DE EERSTE BEURT (nog geen gesprek)\n\nReageer nu volgens de WERKWIJZE.'
      : '\n\n# GESPREK TOT NU TOE\n\n' +
        conversation
          .map((m) => (m.role === 'assistant' ? `## Coach\n${m.content}` : `## Stef\n${m.content}`))
          .join('\n\n') +
        '\n\nReageer nu volgens de WERKWIJZE op basis van Stefs laatste antwoord.'

  // -- stable per-block context (still per-block but doesn't change per turn) -
  const blessureSection = `# BLESSURE-CONSTRAINTS (ALTIJD RESPECTEREN)

Lees Stefs profiel-blessures + actieve blessures hierboven. Bovendien deze structurele regels:
- Geen overhead pressing (OHP, DB shoulder press) — schouder labrumpathologie
- Squats tot parallel, niet diep — knieën (OCD, kraakbeentransplantatie 2016)
- BSS niet na intervaltraining — minstens 1 dag ertussen
- Leg press: beperkt bereik
- RDL's met neutrale rug, initiatie vanuit heupen
- Dead bugs, Pallof press, planks altijd in schema houden — core stabiliteit
- Pull > push volume (schouder-compensatie)
- Face pulls of band pull-aparts in elke upper-dag`

  const schemaEisenSection = `# SCHEMA-EISEN VOLGEND BLOK

- Max 55 minuten per sessie (inclusief warming-up)
- Default: 4 sessies per week (ma-do), vrijdag hardlopen — tenzij Stef in het gesprek iets anders aangeeft
- Roteer ten minste 30% van de oefeningen vs vorig blok (anti-staleness, leer-stimulus)
- Deload elke 3-4 weken (verlaag volume 40-50%, of intensiteit, niet beide)
- Voor elke oefening: VERPLICHT \`sets\`, \`reps\` (range), \`rest_seconds\`, \`rpe\`, \`notes\`. Optioneel \`tempo\`.
- start_date = eerstvolgende maandag NA \`<endDate uit dit blok>\`
- exercises moeten echte herkenbare namen zijn die Hevy kent`

  const werkwijzeSection = `# WERKWIJZE — DE DIALOOG

Je hebt twee opties elke beurt:

**Optie A: Stel vragen** als je nog niet genoeg weet voor een gefundeerd schema.
- Stel zoveel vragen als je nodig hebt. Kan 1 zijn, kan 10 zijn. Geen vast aantal.
- Maak elke vraag scherp en gericht op een keuze die het schema-ontwerp bepaalt.
- Stel GEEN vraag die je al kunt beantwoorden uit Stefs data of reflectie.
- Eindig je antwoord met EXACT deze regel: \`[NU VRAGEN]\`
- STOP daarna. Wacht op Stefs antwoord.

**Optie B: Lever het schema** zodra je genoeg weet.
- Geen vragen meer.
- Begin met CONCLUSIE + LOGICA, eindig met het \`<block_proposal>\` blok.
- Output GEEN \`[NU VRAGEN]\` in deze beurt.

**Hoe je beslist:** ga voor Optie A zolang er nog ONBEKENDE keuzes zijn waar het schema-ontwerp van afhangt. Ga voor Optie B zodra je elke kritische keuze kunt invullen met onderbouwing.

Eerste beurt (geen conversation history): begin altijd met JOURNEY-ERKENNING + ANALYSE-VAN-DIT-BLOK voordat je vragen stelt of het schema levert. Latere beurten: ga direct in op Stefs antwoord.

## Wanneer je het schema levert (Optie B), gebruik deze structuur

1. **CONCLUSIE** (3-5 zinnen): vat samen wat je gelaagde input nu betekent voor de aanpak.
2. **DE LOGICA** (5-8 bullets): leg het ontwerp uit — periodisatie-model, rep-range, rusttijden, progressive overload protocol, frequency + spier-volume (sets/spiergroep/week + MEV/MAV/MRV referentie), deload-timing, recovery-overwegingen, voedings-aanpak.
3. **SCHEMA-VOORSTEL** als laatste blok, exact dit format:

\`\`\`
<block_proposal>
{
  "title": "<korte naam>",
  "schema_type": "<upper_lower|push_pull_legs|full_body|custom>",
  "weeks_planned": <getal>,
  "start_date": "<YYYY-MM-DD>",
  "workout_schedule": [
    {
      "day": "monday",
      "focus": "Upper A",
      "duration_min": 55,
      "exercises": [
        {
          "name": "<exacte naam zoals in Hevy>",
          "sets": 4,
          "reps": "6-8",
          "rest_seconds": 120,
          "rpe": "8",
          "tempo": "3-1-1-0",
          "notes": "Waarom + startgewicht-suggestie in 1 zin"
        }
      ]
    }
  ]
}
</block_proposal>
\`\`\`

Output GEEN andere XML/JSON-blokken. Geen sycophancy. Geen lange intro's.`

  // -- compose system + user --------------------------------------------------
  const system = [
    buildCoachPersona(),
    buildKnowledgeBase(),
    blessureSection,
    schemaEisenSection,
    werkwijzeSection,
  ].join('\n\n')

  const user = [journeyBlock, ditBlokSection, reflectieSection].join('\n\n') + transcript

  return { system, user }
}
```

Add the import at the top of the file:

```typescript
import { buildCoachPersona, buildKnowledgeBase } from '@/lib/ai/coach-core'
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm test tests/lib/ai/block-review-prompt.test.ts`
Expected: PASS — 4 assertions green.

- [ ] **Step 5: Typecheck (catches downstream consumers)**

Run: `pnpm tsc --noEmit`
Expected: error pointing at `src/app/api/block-review/analyse/route.ts:80-86` where the old string return is used — this is fixed in Task 6. **Note this expected error and proceed.**

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/prompts/block-review.ts tests/lib/ai/block-review-prompt.test.ts
git commit -m "refactor(block-review): split prompt into {system, user} using coach-core"
```

---

## Task 6: Migrate block-review route to `streamChat()` + marker fallback

Replace direct `streamText()` use with the shared `streamChat()` helper (which already attaches `cacheControl: ephemeral` to the system message). Add a backend-side marker-fallback that appends `[NU VRAGEN]` when neither marker nor proposal block was emitted — so the UI never deadlocks.

**Files:**
- Modify: `src/app/api/block-review/analyse/route.ts`

- [ ] **Step 1: Read current route**

Read `src/app/api/block-review/analyse/route.ts` end-to-end. Current state: builds prompt as a single string, calls `streamText({ model: anthropic(...), messages: [{ role:'user', content: prompt }], maxOutputTokens: 4096 })`, returns `result.toTextStreamResponse()`. Logs usage in a void IIFE.

- [ ] **Step 2: Rewrite the streaming section**

Replace the body of `POST` from the line `const prompt = buildBlockReviewPrompt(...)` (around line 73) through `return result.toTextStreamResponse()` (around line 122) with:

```typescript
    const { system, user } = buildBlockReviewPrompt({
      data,
      form: {
        reflection: parsed.data.reflection,
        newInBody: null,
        conversation: parsed.data.conversation,
        aiAnalysis: '',
        aiSchemaProposal: null,
        schemaProposalVersion: 0,
        selectedGoals: [],
        endReason: 'completed',
      },
      conversation: parsed.data.conversation,
    })

    const turnNumber = parsed.data.conversation.length + 1
    console.log(
      `[block-review-analyse] start turn ${turnNumber} · model=${BLOCK_REVIEW_MODEL} · sysChars=${system.length} · userChars=${user.length} · schemaId=${schemaId}`,
    )

    const result = streamChat({
      system,
      messages: [{ role: 'user', content: user }],
      model: BLOCK_REVIEW_MODEL,
      maxOutputTokens: 4096,
      meta: { userId: user.id, feature: `block-review-analyse-turn-${turnNumber}` },
    })

    // Marker fallback: tee the stream so we can inspect the full output before
    // closing. If the model emits neither `[NU VRAGEN]` nor `<block_proposal>`,
    // we append `[NU VRAGEN]` so the UI doesn't deadlock waiting for a marker.
    const encoder = new TextEncoder()
    const fallbackStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let acc = ''
        try {
          for await (const chunk of result.textStream) {
            acc += chunk
            controller.enqueue(encoder.encode(chunk))
          }
          const hasMarker = /\[NU VRAGEN\]/i.test(acc)
          const hasProposal = /<block_proposal>/i.test(acc)
          if (!hasMarker && !hasProposal && acc.trim().length > 0) {
            const tail = '\n\n[NU VRAGEN]'
            controller.enqueue(encoder.encode(tail))
            console.warn(
              `[block-review-analyse] no marker emitted on turn ${turnNumber}; appended [NU VRAGEN] fallback`,
            )
          } else if (acc.trim().length === 0) {
            // Empty output — surface as fallback question so UI stays alive
            const tail = 'Geef me even meer context — wat speelt er bij dit blok?\n\n[NU VRAGEN]'
            controller.enqueue(encoder.encode(tail))
            console.warn(
              `[block-review-analyse] empty stream on turn ${turnNumber}; emitted fallback question`,
            )
          }
        } catch (err) {
          console.error('[block-review-analyse] stream error:', err)
          controller.error(err)
          return
        }
        controller.close()
      },
    })

    return new Response(fallbackStream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
```

Update the imports at the top of `route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { streamChat } from '@/lib/ai/client'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aggregateBlockData } from '@/lib/block-review/aggregator'
import { buildBlockReviewPrompt } from '@/lib/ai/prompts/block-review'
import { checkRateLimit } from '@/lib/rate-limit'
```

Remove the now-unused imports: `anthropic from '@ai-sdk/anthropic'`, `streamText from 'ai'`, `logAiUsage from '@/lib/ai/usage'`.

**Naming-collision warning:** the route already destructures the supabase user as `user`, and we also have `user` from the prompt-builder. Rename to avoid the shadow:

```typescript
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    // ... and update all references from `user.id` to `authUser.id` further down
```

Or alternatively rename the prompt outputs:

```typescript
    const { system, user: userPrompt } = buildBlockReviewPrompt({ ... })
    // ... use `userPrompt` in messages
```

Pick **the rename of `userPrompt`** — minimal touch, no cascading renames.

- [ ] **Step 3: Typecheck must now pass**

Run: `pnpm tsc --noEmit`
Expected: PASS — no errors.

- [ ] **Step 4: Run all unit tests**

Run: `pnpm test`
Expected: PASS — existing tests unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/block-review/analyse/route.ts
git commit -m "fix(block-review): streamChat + cacheControl + marker fallback in analyse route"
```

---

## Task 7: Refactor `buildSystemPrompt` (chat) to use coach-core

Replaces the `TONE_BLOCKS` switch and the hand-rolled persona sections with coach-core. The `coachTone` parameter stays in the signature for back-compat with existing call sites (currently passed from `src/app/api/chat/route.ts:331`), but is ignored — coach-core is the single source of truth for voice.

**Files:**
- Modify: `src/lib/ai/prompts/chat-system.ts`
- Create: `tests/lib/ai/chat-system-prompt.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/lib/ai/chat-system-prompt.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '@/lib/ai/prompts/chat-system'

describe('buildSystemPrompt (chat)', () => {
  it('includes coach-core persona (wijze expert)', () => {
    const text = buildSystemPrompt({})
    expect(text).toMatch(/wijze expert/i)
    expect(text).toMatch(/cijfer-eerst/i)
  })

  it('includes evidence-based knowledge base', () => {
    const text = buildSystemPrompt({})
    expect(text).toMatch(/MEV.*MAV.*MRV/i)
    expect(text).toMatch(/ACWR/i)
  })

  it('retains write-back instructions (XML tags)', () => {
    const text = buildSystemPrompt({})
    expect(text).toMatch(/<nutrition_log>/)
    expect(text).toMatch(/<schema_generation>/)
    expect(text).toMatch(/<schema_update>/)
  })

  it('includes cited_memories instructions', () => {
    const text = buildSystemPrompt({})
    expect(text).toMatch(/<cited_memories>/)
  })

  it('renders active schema + injuries + goals when provided', () => {
    const text = buildSystemPrompt({
      activeSchema: {
        title: 'Test Block',
        schema_type: 'upper_lower',
        weeks_planned: 8,
        current_week: 3,
      },
      activeInjuries: [
        { body_location: 'knie L', severity: 'mild', description: 'zeurt na trap', status: 'active' },
      ],
      activeGoals: [
        { title: 'Bench 100kg', category: 'strength', target_value: 100, current_value: 85, deadline: null },
      ],
    })
    expect(text).toMatch(/Test Block/)
    expect(text).toMatch(/knie L/)
    expect(text).toMatch(/Bench 100kg/)
  })

  it('ignores coachTone (back-compat, no error)', () => {
    expect(() =>
      buildSystemPrompt({ coachTone: 'scientific' }),
    ).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm test tests/lib/ai/chat-system-prompt.test.ts`
Expected: FAIL — current chat-system has neither "wijze expert" nor "MEV.*MAV.*MRV" nor `<cited_memories>`.

- [ ] **Step 3: Rewrite `chat-system.ts`**

Replace the entire contents of `src/lib/ai/prompts/chat-system.ts` with:

```typescript
import { currentDateContext } from '@/lib/time/amsterdam'
import { buildCoachPersona, buildKnowledgeBase } from '@/lib/ai/coach-core'

export type CoachTone = 'direct' | 'friendly' | 'scientific'

interface SystemPromptParams {
  activeSchema?: {
    title: string
    schema_type: string
    weeks_planned: number | null
    current_week?: number
  } | null
  activeInjuries?: Array<{
    body_location: string
    severity: string | null
    description: string
    status: string | null
  }>
  activeGoals?: Array<{
    title: string
    category: string
    target_value: number | null
    current_value: number | null
    deadline: string | null
  }>
  customInstructions?: string | null
  /** Kept for back-compat with existing call sites; ignored — coach-core is the single source of voice. */
  coachTone?: CoachTone | null
  /** Markdown block from user_profile, built via lib/profile/build-profile-block. */
  profileBlock?: string | null
}

export function buildSystemPrompt(params: SystemPromptParams = {}): string {
  const { activeSchema, activeInjuries, activeGoals, customInstructions, profileBlock } = params
  const ctx = currentDateContext()

  const persona = buildCoachPersona()
  const knowledge = buildKnowledgeBase()

  const irregularActivities = `## ONREGELMATIGE ACTIVITEITEN

Geen vast patroon, varieert per week — niet aannemen, vragen of in data kijken:
- Padel: 0 tot meerdere keren per week, wisselende dagen/tijden
- Hardlopen: streven naar ~1x per week`

  const motivationSection = `## MOTIVATIE & AANPAK

Stef houdt het inmiddels lang vol en heeft er plezier in — geen "afhaak-risico" aannemen.
Aanpak:
- Maak progressie zichtbaar met echte cijfers
- Korte termijn wins elke 1-2 weken
- Flexibiliteit: help aanpassen waar nodig
- Ochtendtraining beschermen (na werk lukt niet)
- 30 min gym > thuisblijven
- Bij twijfel: push door`

  const capabilitiesSection = `## DATA WAAR JE BIJ KAN

Je hebt directe toegang tot Stefs trainingsdata via tools:
- Workouts (Hevy), runs (Apple Health/Strava), padel sessies, daily activity, voedingslogs, blessure-historie, body composition, schema's, goals.
- Roep tools aan voor concrete cijfers in plaats van te schatten of te gokken.
- Refereer altijd aan echte waardes, niet aan algemeenheden.`

  const gedragsregels = `## GEDRAGSREGELS — SPECIFIEK VOOR CHAT-CONTEXT

- Bij voedingsinput: schat macro's, geef kort oordeel, sla op via \`<nutrition_log>\`
- Bij blessure-melding: check recente workouts, analyseer, sla op via \`<injury_log>\`
- Bij schema-request: gebruik progressie-data + roteer t.o.v. vorige schema's
- Bij wekelijkse review: vergelijk met vorige weken, spot trends
- Bij pijn in knieën/schouder: direct aanpassen, niet doorduwen
- Communiceer in het Nederlands`

  const profileFromDb = profileBlock?.trim()
  const staticSections = [
    persona,
    knowledge,
    profileFromDb,
    irregularActivities,
    motivationSection,
    capabilitiesSection,
    gedragsregels,
  ]
    .filter(Boolean)
    .join('\n\n')

  const dynamicSchema = activeSchema
    ? `${activeSchema.title} (${activeSchema.schema_type}, week ${activeSchema.current_week ?? '?'} van ${activeSchema.weeks_planned})`
    : 'Geen actief schema'

  const dynamicInjuries = activeInjuries?.length
    ? activeInjuries.map((i) => `- ${i.body_location} (${i.severity}): ${i.description} [${i.status}]`).join('\n')
    : 'Geen actieve blessures geregistreerd'

  const dynamicGoals = activeGoals?.length
    ? activeGoals
        .map(
          (g) =>
            `- [${g.category}] ${g.title}: ${g.current_value ?? '?'} → ${g.target_value}${
              g.deadline ? ` (deadline: ${g.deadline})` : ''
            }`,
        )
        .join('\n')
    : 'Geen actieve doelen'

  const dynamicSections = `## HUIDIG MOMENT (autoritatief — gebruik deze waarden voor "vandaag", "deze week", "gisteren")

- Datum: ${ctx.longLabel}
- ISO-datum: ${ctx.date}
- Lokale tijd: ${ctx.time} (${ctx.timezone})
- Maandag van deze week: ${ctx.weekStart}

Negeer eventuele "knowledge cutoff"-aannames over de huidige datum.

## HUIDIG SCHEMA
${dynamicSchema}

## ACTIEVE BLESSURES
${dynamicInjuries}

## ACTIEVE DOELEN
${dynamicGoals}`

  const writeBackInstructions = `## WRITE-BACKS — gestructureerde tags

Voeg, wanneer relevant, één of meer van deze tags **vóór** je antwoord toe. De app stript ze automatisch.

### Voedingslog (alleen bij actief loggen)
\`\`\`
<nutrition_log>{"input":"<beschrijving van de maaltijd>"}</nutrition_log>
\`\`\`

### Blessurerapport
\`\`\`
<injury_log>{"body_location":"<lichaamsdeel>","severity":"<mild|moderate|severe>","description":"<korte beschrijving>"}</injury_log>
\`\`\`

### Nieuw trainingsschema (alleen na expliciete bevestiging van Stef)
\`\`\`
<schema_generation>{"title":"...","schema_type":"<upper_lower|push_pull_legs|full_body|custom>","weeks_planned":<n>,"start_date":"YYYY-MM-DD","workout_schedule":[...]}</schema_generation>
\`\`\`
\`schema_type\` MOET een van: \`upper_lower\`, \`push_pull_legs\`, \`full_body\`, \`custom\`.

### Schema aanpassen (partiële wijziging)
Gebruik dit voor kleine aanpassingen, niet een volledig nieuw schema:
\`\`\`
<schema_update>{"action":"replace_exercise|add_exercise|remove_exercise|modify_sets|swap_days","day":"...","old_exercise":"...","new_exercise":{...},"exercise_name":"...","sets":<n>,"reps":"...","swap_with_day":"..."}</schema_update>
\`\`\`
Gebruik oefening-namen exact zoals in het schema (Hevy-namen).

### Memory-citaten (verplicht wanneer je naar geheugen verwijst)
Eindig je antwoord met:
\`\`\`
<cited_memories>id1,id2</cited_memories>
\`\`\`
Gebruik de id-prefixes (eerste 8 chars) zoals ze in "MIJN GEHEUGEN OVER JOU" verschijnen. Dit houdt het geheugen vers door \`last_confirmed_at\` te bumpen.`

  const customSection = customInstructions?.trim()
    ? `## CUSTOM INSTRUCTIES VAN GEBRUIKER

${customInstructions.trim()}

---

`
    : ''

  return `${staticSections}

---

${customSection}${dynamicSections}

---

${writeBackInstructions}

---

Je ontvangt een DATA-CONTEXT blok met actuele gegevens. Gebruik deze data om je antwoorden te personaliseren.`
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm test tests/lib/ai/chat-system-prompt.test.ts`
Expected: PASS — 6 assertions green.

- [ ] **Step 5: Typecheck and full test sweep**

Run: `pnpm tsc --noEmit && pnpm test`
Expected: PASS — chat route uses the same signature, `coachTone` still accepted as no-op.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/prompts/chat-system.ts tests/lib/ai/chat-system-prompt.test.ts
git commit -m "refactor(chat-system): use coach-core persona + knowledge, deprecate TONE_BLOCKS"
```

---

## Task 8: Parse `<cited_memories>` write-back and call `confirmMemory()`

When the coach emits `<cited_memories>11111111,22222222</cited_memories>`, the chat route strips it (so it doesn't render to the user) and calls `confirmMemory()` for each cited memory by matching the prefix to a full UUID.

**Files:**
- Modify: `src/app/api/chat/route.ts`

- [ ] **Step 1: Add `citedMemories` to the writeback parser**

Edit `src/app/api/chat/route.ts`. Update the `WritebackResult` type (around line 101):

```typescript
interface WritebackResult {
  cleanText: string
  nutritionLog?: NutritionLogData
  injuryLog?: InjuryLogData
  schemaGeneration?: SchemaGenerationData
  schemaUpdate?: SchemaUpdateData
  citedMemories?: string[]   // first-8-char prefixes emitted by the coach
}
```

Update `extractWritebacks` (around line 109-157). Append before the final `return`:

```typescript
  let citedMemories: string[] | undefined
  const citedMatch = /<cited_memories>([\s\S]*?)<\/cited_memories>/i.exec(text)
  if (citedMatch) {
    citedMemories = citedMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^[a-f0-9]{4,}$/i.test(s))
    cleanText = cleanText.replace(citedMatch[0], '').trim()
  }
```

Then update the return:

```typescript
  return { cleanText, nutritionLog, injuryLog, schemaGeneration, schemaUpdate, citedMemories }
```

- [ ] **Step 2: Wire `confirmMemory()` calls after response is processed**

Find the destructure of writebacks in the route body (around line 368-369):

```typescript
const { cleanText, nutritionLog, injuryLog, schemaGeneration, schemaUpdate } =
  extractWritebacks(fullResponse)
```

Replace with:

```typescript
const { cleanText, nutritionLog, injuryLog, schemaGeneration, schemaUpdate, citedMemories } =
  extractWritebacks(fullResponse)
```

Then, **after the assistant message is saved to `chat_messages`** (around line 389, after the `await admin.from('chat_messages').insert(...)`), add:

```typescript
// Bump last_confirmed_at on memories the coach actively cited.
// Coach emits first-8-char prefixes — map back to full UUIDs.
if (citedMemories && citedMemories.length > 0) {
  try {
    const prefixOrs = citedMemories
      .map((p) => `id.ilike.${p}%`)
      .join(',')
    const { data: matches } = await admin
      .from('coaching_memory')
      .select('id')
      .eq('user_id', user.id)
      .or(prefixOrs)
    if (matches && matches.length > 0) {
      await Promise.all(
        matches.map((m) =>
          admin
            .from('coaching_memory')
            .update({
              confidence: 1.0,
              last_confirmed_at: new Date().toISOString(),
            })
            .eq('id', m.id),
        ),
      )
    }
  } catch (err) {
    console.error('[chat] cited_memories confirm failed (non-fatal):', err)
  }
}
```

This uses an inline update (matching `confirmMemory`'s logic at `src/lib/ai/memory-decay.ts:60-66`) so we keep the user-scope filter (`eq('user_id', user.id)`) for safety. Calling `confirmMemory(id)` would also work but loses the user-scope guard.

- [ ] **Step 3: Typecheck + tests**

Run: `pnpm tsc --noEmit && pnpm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat(chat): parse <cited_memories> writeback and refresh memory confidence"
```

---

## Task 9: Manual end-to-end verification

Unit tests can't prove the lege-response-bug is gone — that's a real-network behaviour. Verify end-to-end in dev.

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`
Wait for `Ready - started server on http://localhost:3000`.

- [ ] **Step 2: Verify block-review wizard streams properly**

In a browser:
1. Log in as `stef@pulse.test` / `testpassword123`
2. Navigate to `/block-review`
3. Click through to **Stap 4 / 6 — Coach analyse**
4. Observe: the first coach turn must stream visible content within 5-10s. **No empty COACH bubble.**
5. Wait for the turn to complete. The wizard should either render an input box (because `[NU VRAGEN]` was emitted or backend-appended) or proceed to the schema-proposal stage.

If the COACH bubble still renders empty:
- Open browser devtools → Network tab → find the `/api/block-review/analyse` request
- Check `Response` is a streaming text body with content
- Check Vercel/console logs for `[block-review-analyse]` lines — expect `start turn 1 · model=claude-sonnet-4-6 · sysChars=... · userChars=...`
- If `acc.trim().length === 0` warning fired in logs, the model returned nothing — escalate. Otherwise the UI may be discarding content; inspect `AnalysisStep.tsx:65-103` (`sendTurn` reader loop).

- [ ] **Step 3: Verify cache hit on turn 2**

In the wizard, type a short reply ("ga door") and submit. Wait for the second coach turn to start.

Check Vercel/console logs for the `ai_usage_log` entry (or query `select feature, usage, cache_read_tokens from ai_usage_log order by created_at desc limit 4`). On turn 2 you should see `cache_read_tokens` ≈ the system prompt size (~6-8k tokens) — that's the cache hit.

- [ ] **Step 4: Verify chat coach references memory and emits `<cited_memories>`**

Navigate to `/coach`. Send a message that should pull from existing memory, e.g. "wat weet je nog over mijn voorkeuren".

Observe:
1. Response should reference at least one specific memory item from "MIJN GEHEUGEN OVER JOU" (the new persona requires it).
2. The visible response should **not** contain a literal `<cited_memories>` tag (the route strips it).
3. Query the database:
   ```sql
   select id, value, last_confirmed_at
     from coaching_memory
    where user_id = '<stef's user_id>'
    order by last_confirmed_at desc
    limit 5;
   ```
   The most recently confirmed rows should have `last_confirmed_at` from within the last minute.

- [ ] **Step 5: Verify chat coach voice (smoke)**

Send "geef advies over deze week". The response should:
- Cite at least one cijfer from your data
- Stay under ~8 zinnen unless the question warrants depth
- Not start with sycophantic filler
- Not end with "succes!" or "you got this"

If the voice doesn't match (still feels like the old "great question!" tone) inspect logs to confirm the new system prompt is being sent — it may be cached on an older one.

- [ ] **Step 6: Commit nothing if all checks pass — write findings to PR description**

If all verifications pass: no commit needed (the implementation commits cover the change).

If issues found that need a code fix: open a new task entry, fix, re-verify.

---

## Self-review (executed by plan-writer, not by engineer)

**Spec coverage check:**
- ✅ `coach-core` module met `buildCoachPersona()`, `buildKnowledgeBase()`, `buildMemoryReadBlock()` → Task 1, 2, 4
- ✅ Block-review prompt split into system/user → Task 5
- ✅ Block-review route uses streamChat + cacheControl + marker fallback → Task 6
- ✅ Chat-coach uses coach-core (vervangt TONE_BLOCKS, voegt knowledge toe) → Task 7
- ✅ Memory-confirm loop via `<cited_memories>` → Task 8
- ✅ Eerlijkheids-regel scherpen → embedded in `buildCoachPersona()` (Task 1: "Eerlijk waar het telt")

**No placeholders:** every step has runnable code, exact paths, exact commands.

**Type consistency:** `buildBlockReviewPrompt` returns `BlockReviewPrompt = { system, user }` — used consistently in Task 5 (export) and Task 6 (destructure with rename `userPrompt` to avoid `user`-collision).

**Known limitations:**
- `buildMemoryReadBlock()` is created in Task 4 but **not yet wired into chat or block-review prompts** in fase 1. It will be used by belief-aware prompts in fase 2. This is by design — fase 1 keeps memory reads via the existing `assembleThinContext` path. If you (the engineer) want to wire it into chat's system prompt as a smoke test, that's optional — add a call site in `buildSystemPrompt` and assert it doesn't break.
- Block-review prompt still embeds memory implicitly via the journey-block (`buildJourneyBlock` reads `data.journey.coachingMemory`). Wiring the unified `buildMemoryReadBlock` here is a fase-2 refinement.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-22-coach-fase1-foundation.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for keeping each task's context isolated.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints. Faster turnaround but loads more context into the current session.

Which approach?
