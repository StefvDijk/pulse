import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { createAdminClient } from '@/lib/supabase/admin'
import { MEMORY_MODEL } from '@/lib/ai/client'
import { logAiUsage } from '@/lib/ai/usage'
import { todayAmsterdam } from '@/lib/time/amsterdam'

// ---------------------------------------------------------------------------
// Extractor system prompt
// ---------------------------------------------------------------------------

const EXTRACTOR_SYSTEM = `Je analyseert één gespreksturn tussen Stef en zijn personal training AI coach.
Extraheer feiten die de coach moet onthouden voor toekomstige gesprekken.

Output: een JSON-array met updates. Geef een LEGE ARRAY [] terug als er niets nieuws of gewijzigds is.

Elke update heeft dit formaat:
{"key": "snake_case_sleutel", "category": "CATEGORIE", "value": "korte beschrijving (max 150 tekens)", "action": "upsert"}
of
{"key": "snake_case_sleutel", "action": "delete"}

Categorieën:
- program    → huidige trainingsfase, schema-naam, wekelijks ritme, aankomende races/events
- lifestyle  → werk, slaappatroon, stress, reizen, drukke periodes
- injury     → blessure-updates, nieuwe klachten, herstelvoortgang, pijnmeldingen
- preference → trainings- of voedingsvoorkeuren, dingen die goed/slecht werken
- pattern    → gedragspatronen die Stef laat zien (bijv. slaat maandag over, goede ochtenden)
- goal       → huidige prioriteiten en korte-termijndoelen

Regels:
- Alleen echte nieuwe of gewijzigde informatie opslaan — geen duplicaten
- Gebruik action:"delete" als een feit uitdrukkelijk niet meer klopt
- Wees specifiek en voeg datum toe als dat relevant is (bijv. "per 1 apr 2026")
- Max 5 updates per beurt
- Geef UITSLUITEND geldige JSON terug, geen uitleg`

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MemoryUpdate {
  key: string
  category: string
  value?: string
  action: 'upsert' | 'delete'
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Analyzes a single conversation turn and upserts relevant facts into
 * coaching_memory. Designed to be called fire-and-forget after each AI
 * response — errors are caught and logged, never thrown.
 */
export async function extractAndUpdateMemory(
  userId: string,
  userMessage: string,
  assistantResponse: string,
): Promise<void> {
  try {
    const admin = createAdminClient()

    // Fetch existing memories so the extractor avoids creating duplicates
    const { data: existing } = await admin
      .from('coaching_memory')
      .select('key, category, value')
      .eq('user_id', userId)

    const existingSection = existing?.length
      ? `\nBekende herinneringen (sla NIET opnieuw op tenzij gewijzigd):\n${existing.map((m) => `[${m.key}] ${m.value}`).join('\n')}`
      : ''

    const userContent = `Gespreksturn:

GEBRUIKER: ${userMessage}

COACH: ${assistantResponse.slice(0, 2000)}${existingSection}`

    const startedAt = Date.now()
    const { text, usage } = await generateText({
      model: anthropic(MEMORY_MODEL),
      system: EXTRACTOR_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
      maxOutputTokens: 512,
    })
    logAiUsage({
      userId,
      feature: 'memory_extractor',
      model: MEMORY_MODEL,
      usage: {
        inputTokens: usage.inputTokens ?? null,
        outputTokens: usage.outputTokens ?? null,
      },
      durationMs: Date.now() - startedAt,
    })

    // Extract JSON array — be lenient about surrounding whitespace/text
    const match = /\[[\s\S]*\]/.exec(text)
    if (!match) return

    let updates: MemoryUpdate[]
    try {
      updates = JSON.parse(match[0]) as MemoryUpdate[]
    } catch {
      return
    }

    if (!Array.isArray(updates) || updates.length === 0) return

    const VALID_CATEGORIES = new Set(['program', 'lifestyle', 'injury', 'preference', 'pattern', 'goal'])

    for (const update of updates.slice(0, 5)) {
      if (!update.key || !update.action) continue

      if (update.action === 'delete') {
        await admin
          .from('coaching_memory')
          .delete()
          .eq('user_id', userId)
          .eq('key', update.key)
        continue
      }

      if (!update.value || !VALID_CATEGORIES.has(update.category)) continue

      await admin.from('coaching_memory').upsert(
        {
          user_id: userId,
          key: update.key,
          category: update.category,
          value: update.value,
          source_date: todayAmsterdam(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,key' },
      )
    }
  } catch (err) {
    // Fire-and-forget: never let memory extraction crash the chat response
    console.error('[memory-extractor] Error:', err)
  }
}
