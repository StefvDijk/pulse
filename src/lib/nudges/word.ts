import { z } from 'zod'
import { createJsonCompletion, MEMORY_MODEL } from '@/lib/ai/client'
import { parseAiJson } from '@/lib/ai/parse-ai-json'
import { getCoachConfig } from '@/lib/ai/coaches/registry'
import type { NudgeDraft } from './protein-nudge'

const WordingSchema = z.object({ text: z.string().min(1).max(240) })

/**
 * The LLM writes ONLY the wording of a nudge (issue #42) — never whether it
 * appears (that's the deterministic trigger). Uses the cheap memory model and
 * falls back to the trigger's deterministic body so a nudge is never empty.
 */
export async function wordNudge(userId: string, draft: NudgeDraft): Promise<string> {
  const coach = getCoachConfig(draft.coachId)
  try {
    const raw = await createJsonCompletion({
      system:
        `Je bent de ${coach.identity.name}. Schrijf één korte, motiverende nudge (NL, max 25 woorden, ` +
        `geen uitroeptekens, geen vraag) op basis van de feiten. Geef JSON: {"text": "..."}.`,
      userMessage: `Feit: eiwit zit ${draft.facts.streak} dagen op rij onder doel (t/m ${draft.facts.latestDate}).`,
      model: MEMORY_MODEL,
      meta: { userId, feature: 'nudge' },
    })
    return WordingSchema.parse(parseAiJson(raw)).text
  } catch (err) {
    console.error('[wordNudge] falling back to deterministic body:', err)
    return draft.fallbackBody
  }
}
