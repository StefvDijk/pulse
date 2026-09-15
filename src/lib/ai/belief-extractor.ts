import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { MEMORY_MODEL } from '@/lib/ai/client'
import { logAiUsage } from '@/lib/ai/usage'
import { recomputeBelief, type EvidenceItem } from '@/lib/ai/belief-update'
import type { Json } from '@/types/database'
import { reserveAiBudget, type AiBudgetReservation } from '@/lib/ai/budget'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BeliefScope = 'training' | 'nutrition' | 'recovery' | 'lifestyle' | 'preference'

export interface RunBeliefExtractorInput {
  userId: string
  scope: BeliefScope
  eventSummary: string
}

interface RunBeliefExtractorOptions {
  /** Re-throw failures so batch/cron callers can report honest run status. */
  strict?: boolean
}

const EvidenceSchema = z.object({
  kind: z.enum(['for', 'against']),
  observation: z.string().trim().min(1).max(1000),
  source: z.string().trim().min(1).max(100),
})

const ExtractorActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    hypothesis_text: z.string().trim().min(1).max(1000),
    category: z.enum(['training', 'nutrition', 'recovery', 'lifestyle', 'preference']),
    evidence: EvidenceSchema,
  }),
  z.object({
    action: z.literal('evidence'),
    target_id: z.string().uuid(),
    evidence: EvidenceSchema,
  }),
])

type ExtractorAction = z.infer<typeof ExtractorActionSchema>

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

export async function runBeliefExtractor(
  input: RunBeliefExtractorInput,
  options: RunBeliefExtractorOptions = {},
): Promise<void> {
  let reservation: AiBudgetReservation | null = null
  try {
    const admin = createAdminClient()
    const { data: existing, error: existingError } = await admin
      .from('coach_beliefs')
      .select('id, hypothesis_text, category, status')
      .eq('user_id', input.userId)
      .in('status', ['active', 'confirmed'])
    if (existingError) throw existingError

    const existingBlock =
      existing && existing.length
        ? `\n\nBestaande hypotheses (refereer naar target_id voor evidence-updates):\n${existing
            .map((b) => `- [${b.id}] (${b.category}, ${b.status}) ${b.hypothesis_text}`)
            .join('\n')}`
        : ''

    const userMessage = `Scope: ${input.scope}\n\nGebeurtenis:\n${input.eventSummary.slice(0, 2000)}${existingBlock}`

    const startedAt = Date.now()
    reservation = await reserveAiBudget(input.userId, MEMORY_MODEL, 512)
    const { text, usage } = await generateText({
      model: anthropic(MEMORY_MODEL),
      system: EXTRACTOR_SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
      maxOutputTokens: 512,
    })

    await logAiUsage({
      userId: input.userId,
      feature: 'belief-extractor',
      model: MEMORY_MODEL,
      usage: {
        inputTokens: usage.inputTokens ?? null,
        outputTokens: usage.outputTokens ?? null,
        cacheReadTokens: null,
      },
      durationMs: Date.now() - startedAt,
      reservation,
    })
    reservation = null

    // Extract the JSON array even when the model wraps it in prose — a bare
    // JSON.parse(text) silently failed in production whenever Haiku prefixed a
    // sentence, so coach_beliefs never got populated. Mirrors memory-extractor.
    const match = /\[[\s\S]*\]/.exec(text)
    if (!match) {
      throw new Error(`No JSON array in Haiku output (raw length ${text.length})`)
    }

    let rawActions: unknown
    try {
      rawActions = JSON.parse(match[0])
    } catch (parseErr) {
      throw new Error('Belief extractor returned invalid JSON', { cause: parseErr })
    }
    const parsedActions = z.array(ExtractorActionSchema).max(2).safeParse(rawActions)
    if (!parsedActions.success) {
      throw new Error(`Belief extractor returned invalid actions: ${parsedActions.error.message}`)
    }
    if (parsedActions.data.length === 0) return

    for (const action of parsedActions.data) {
      const applied = await applyAction(admin, input.userId, action)
      if (!applied && options.strict) {
        throw new Error(`Belief extractor action could not be applied: ${action.action}`)
      }
    }
  } catch (err) {
    if (reservation) {
      await logAiUsage({
        userId: input.userId,
        feature: 'belief-extractor',
        model: MEMORY_MODEL,
        status: 'error',
        errorCode: (err as { name?: string })?.name ?? 'EXTRACTOR_ERROR',
        reservation,
      })
    }
    console.error('[belief-extractor] error (non-fatal):', err)
    if (options.strict) throw err
  }
}

// ---------------------------------------------------------------------------
// Action application
// ---------------------------------------------------------------------------

async function applyAction(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  action: ExtractorAction,
): Promise<boolean> {
  const nowIso = new Date().toISOString()
  const evidenceItem: EvidenceItem = {
    date: nowIso,
    observation: action.evidence.observation.slice(0, 240),
    source: action.evidence.source.slice(0, 40),
    kind: action.evidence.kind,
  }

  if (action.action === 'create') {
    const initial = {
      evidence_for: action.evidence.kind === 'for' ? [evidenceItem] : [],
      evidence_against: action.evidence.kind === 'against' ? [evidenceItem] : [],
      status: 'active' as const,
    }
    const { confidence, status } = recomputeBelief(initial)
    const { error } = await admin.from('coach_beliefs').insert({
      user_id: userId,
      hypothesis_text: action.hypothesis_text.slice(0, 240),
      category: action.category,
      evidence_for: initial.evidence_for as unknown as Json[],
      evidence_against: initial.evidence_against as unknown as Json[],
      confidence,
      status,
      last_tested_at: nowIso,
    })
    if (error) throw error
    return true
  }

  if (action.action === 'evidence' && action.target_id) {
    const { data, error: queryError } = await admin
      .from('coach_beliefs')
      .select('evidence_for, evidence_against, status')
      .eq('id', action.target_id)
      .eq('user_id', userId)
      .maybeSingle()
    if (queryError) throw queryError
    if (!data) return false

    const existingFor = (data.evidence_for ?? []) as unknown as EvidenceItem[]
    const existingAgainst = (data.evidence_against ?? []) as unknown as EvidenceItem[]
    const evidence_for: EvidenceItem[] = action.evidence.kind === 'for' ? [...existingFor, evidenceItem] : existingFor
    const evidence_against: EvidenceItem[] = action.evidence.kind === 'against' ? [...existingAgainst, evidenceItem] : existingAgainst

    const { confidence, status } = recomputeBelief({
      evidence_for,
      evidence_against,
      status: data.status as 'active' | 'confirmed' | 'superseded' | 'rejected',
    })

    const { error: updateError } = await admin
      .from('coach_beliefs')
      .update({
        evidence_for: evidence_for as unknown as Json[],
        evidence_against: evidence_against as unknown as Json[],
        confidence,
        status,
        last_tested_at: nowIso,
      })
      .eq('id', action.target_id)
    if (updateError) throw updateError
    return true
  }

  return false
}
