/**
 * Thin context assembler for the agentic chat.
 *
 * [B4 — Sprint 3] This file used to be 990 lines: a giant type-specific
 * context builder (assembleContext + 7 builders + helpers) that nothing
 * called. Only assembleThinContext + loadCoachingMemory + loadRecentPRs
 * were live. The dead bulk has been removed; if any part of the legacy
 * pre-assembled context is ever needed again, look at the audit-tagged
 * commit before this one in git history.
 *
 * Active surface area:
 *  - classifyQuestion (re-export from classifier)
 *  - assembleThinContext: ~30 lines of context the agent always gets
 *    (coaching memory + recent PRs). Everything else is tool-fetched.
 */

export { classifyQuestion, type QuestionType } from './classifier'

import { createAdminClient } from '@/lib/supabase/admin'
import { formatDayMonth } from '@/lib/formatters'

// ---------------------------------------------------------------------------
// Small utilities used by the loaders below
// ---------------------------------------------------------------------------

function num(v: number | null | undefined, decimals = 0): string {
  if (v === null || v === undefined) return '—'
  return v.toFixed(decimals)
}

// ---------------------------------------------------------------------------
// Universal context loaders (always injected, agent never has to ask)
// ---------------------------------------------------------------------------

async function loadCoachingMemory(userId: string): Promise<string | null> {
  const supabase = createAdminClient()
  // [B5] Cap at 30 most-recent memories: prevents the memory table (which
  // grows unbounded over months) from inflating every chat-request's context.
  const { data } = await supabase
    .from('coaching_memory')
    .select('category, key, value, source_date')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(30)

  if (!data || data.length === 0) return null

  const byCategory: Record<string, string[]> = {}
  for (const m of data) {
    if (!byCategory[m.category]) byCategory[m.category] = []
    byCategory[m.category].push(m.value)
  }

  const lines: string[] = []
  for (const [cat, values] of Object.entries(byCategory)) {
    lines.push(`${cat.toUpperCase()}:`)
    for (const v of values) lines.push(`  • ${v}`)
  }

  return ['--- COACHING GEHEUGEN ---', ...lines].join('\n')
}

async function loadRecentPRs(userId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('personal_records')
    .select('achieved_at, value, unit, exercise_definitions(name)')
    .eq('user_id', userId)
    .order('achieved_at', { ascending: false })
    .limit(10)

  if (!data || data.length === 0) return null

  const lines = data.map((pr) => {
    const name = (pr.exercise_definitions as { name: string } | null)?.name ?? 'Onbekend'
    return `${formatDayMonth(pr.achieved_at)}: ${name} — ${num(pr.value)}${pr.unit ?? ''}`
  })

  return ['--- RECENTE PERSONAL RECORDS ---', ...lines].join('\n')
}

// ---------------------------------------------------------------------------
// Thin context assembler — for agentic tool-calling mode.
// Only loads coaching memory + recent PRs. Tools fill the rest on demand.
// ---------------------------------------------------------------------------

export async function assembleThinContext(userId: string): Promise<string> {
  const [memory, prs] = await Promise.allSettled([
    loadCoachingMemory(userId),
    loadRecentPRs(userId),
  ])

  const sections: string[] = []

  if (memory.status === 'fulfilled' && memory.value) {
    sections.push(memory.value)
  }
  if (prs.status === 'fulfilled' && prs.value) {
    sections.push(prs.value)
  }

  if (sections.length === 0) return ''
  return `\n\n---\n## DATA-CONTEXT\n\n${sections.join('\n\n')}\n---`
}
