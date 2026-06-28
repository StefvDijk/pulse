export { classifyQuestion, type QuestionType } from './classifier'

import { createAdminClient } from '@/lib/supabase/admin'
import { buildMemoryReadBlock } from './coach-core'

// ---------------------------------------------------------------------------
// Date/number helpers — alle data-windows zijn Amsterdam-relatief, niet UTC.
// ---------------------------------------------------------------------------

function formatDateShort(d: string): string {
  return new Date(d).toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  })
}

function num(v: number | null | undefined, decimals = 0): string {
  if (v == null) return '?'
  return decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString()
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
    return `${formatDateShort(pr.achieved_at)}: ${name} — ${num(pr.value)}${pr.unit ?? ''}`
  })

  return ['--- RECENTE PERSONAL RECORDS ---', ...lines].join('\n')
}

async function loadRecentCheckins(userId: string): Promise<string | null> {
  // [audit #23] The coach never saw same-day check-ins ("voelen 2/5"), so it
  // couldn't react to how Stef said he feels. Surface the last few so the
  // model can acknowledge a low day instead of ignoring it.
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('daily_checkins')
    .select('date, feeling, sleep_quality, note')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(3)

  if (!data || data.length === 0) return null

  const lines = data.map((c) => {
    const note = c.note ? ` — "${c.note.slice(0, 140)}"` : ''
    return `${formatDateShort(c.date)}: voelen ${c.feeling}/5, slaap ${c.sleep_quality}/5${note}`
  })

  return ['--- RECENTE CHECK-INS ---', ...lines].join('\n')
}

// ---------------------------------------------------------------------------
// Thin context assembler (for agentic tool-calling mode)
// Loads the canonical memory read-block (semantic memory + working
// hypotheses) + recent PRs + recent check-ins — tools fill the rest. Audit #21:
// uses buildMemoryReadBlock so the coach actually SEES its own coach_beliefs,
// which were written to the DB but never injected into any prompt. Sits in the
// UNCACHED dynamic block (appended after the cached static system prompt), so
// belief churn never invalidates Anthropic's prompt cache.
// ---------------------------------------------------------------------------

export async function assembleThinContext(userId: string): Promise<string> {
  const [memory, prs, checkins] = await Promise.allSettled([
    buildMemoryReadBlock(userId),
    loadRecentPRs(userId),
    loadRecentCheckins(userId),
  ])

  const sections: string[] = []

  if (memory.status === 'fulfilled' && memory.value) {
    sections.push(memory.value)
  }
  if (checkins.status === 'fulfilled' && checkins.value) {
    sections.push(checkins.value)
  }
  if (prs.status === 'fulfilled' && prs.value) {
    sections.push(prs.value)
  }

  if (sections.length === 0) return ''
  return `\n\n---\n## DATA-CONTEXT\n\n${sections.join('\n\n')}\n---`
}
