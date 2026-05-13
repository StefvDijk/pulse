/**
 * Conversation history compression.
 *
 * [B8 — Sprint 3] When a chat session exceeds ~15 turns, the oldest
 * turns get summarized by Haiku into a single system-note message,
 * preserving the conversational tail (last ~6 turns intact).
 *
 * Why: previously chat/route.ts loaded the most-recent 20 messages
 * verbatim. Long-running sessions (40+ turns over a week) silently
 * lost everything past turn 20, even though earlier turns might still
 * be relevant to the current question.
 *
 * Implementation uses Haiku for the summary (fast + cheap) and only
 * fires when there's actually something to compress — short sessions
 * still get the verbatim history.
 */

import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { MEMORY_MODEL } from './client'

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

/** Threshold below which no compression happens (verbatim history wins). */
const COMPRESS_AT = 16

/** How many of the most-recent turns to keep verbatim after compression. */
const KEEP_RECENT = 6

const SUMMARY_PROMPT = `Vat het volgende stukje gesprek samen in maximaal 6 zinnen.
Focus op: beslissingen, openstaande punten, gemaakte afspraken, en eventuele blessure-/voedings-feiten.
Geen filler ("Stef vroeg of..." → gewoon de info). Geef alleen de samenvatting terug, geen intro.`

/**
 * Compress a long chat history.
 *
 * Returns the original array unchanged if length ≤ COMPRESS_AT. Otherwise
 * summarizes the oldest (length - KEEP_RECENT) turns into one synthetic
 * user-message tagged [Eerdere conversatie samengevat] and prepends it
 * to the kept tail.
 *
 * Errors are non-fatal: on summary-call failure we fall back to slicing
 * to the most-recent KEEP_RECENT turns (so we don't blow up on Haiku
 * downtime).
 */
export async function compressHistory(history: ChatTurn[]): Promise<ChatTurn[]> {
  if (history.length <= COMPRESS_AT) return history

  const toCompress = history.slice(0, history.length - KEEP_RECENT)
  const keep = history.slice(history.length - KEEP_RECENT)

  const transcript = toCompress
    .map((t) => `${t.role === 'user' ? 'Stef' : 'Coach'}: ${t.content}`)
    .join('\n')

  try {
    const { text } = await generateText({
      model: anthropic(MEMORY_MODEL),
      maxOutputTokens: 400,
      system: SUMMARY_PROMPT,
      prompt: transcript,
    })

    const summary: ChatTurn = {
      role: 'user',
      content: `[Eerdere conversatie samengevat — ${toCompress.length} turns]\n${text.trim()}`,
    }
    return [summary, ...keep]
  } catch (err) {
    console.error('[history-compressor] summarize failed, falling back to tail-slice:', err)
    return keep
  }
}
