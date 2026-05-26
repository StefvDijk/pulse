import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createAdminClient } from '@/lib/supabase/admin'
import { MEMORY_MODEL } from '@/lib/ai/client'
import { logAiUsage } from '@/lib/ai/usage'
import { recomputeBelief, type EvidenceItem } from '@/lib/ai/belief-update'
import type { Json } from '@/types/database'

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
      evidence_for: initial.evidence_for as unknown as Json[],
      evidence_against: initial.evidence_against as unknown as Json[],
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

    const existingFor = (data.evidence_for ?? []) as unknown as EvidenceItem[]
    const existingAgainst = (data.evidence_against ?? []) as unknown as EvidenceItem[]
    const evidence_for: EvidenceItem[] = action.evidence.kind === 'for' ? [...existingFor, evidenceItem] : existingFor
    const evidence_against: EvidenceItem[] = action.evidence.kind === 'against' ? [...existingAgainst, evidenceItem] : existingAgainst

    const { confidence, status } = recomputeBelief({
      evidence_for,
      evidence_against,
      status: data.status as 'active' | 'confirmed' | 'superseded' | 'rejected',
    })

    await admin
      .from('coach_beliefs')
      .update({
        evidence_for: evidence_for as unknown as Json[],
        evidence_against: evidence_against as unknown as Json[],
        confidence,
        status,
        last_tested_at: nowIso,
      })
      .eq('id', action.target_id)
  }
}
