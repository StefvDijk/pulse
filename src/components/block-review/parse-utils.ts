import type { ProgramAudit } from './types'

interface ProposalShape {
  title: string
  schema_type: string
  weeks_planned: number
  start_date: string
  workout_schedule: Array<{
    day: string
    focus: string
    duration_min?: number
    sport_type?: 'gym' | 'run' | 'padel' | 'rest'
    run_type?: string
    exercises?: Array<{
      name: string
      sets?: number
      reps?: string
      rest_seconds?: number
      rpe?: string
      tempo?: string
      notes?: string
    }>
  }>
  progression?: { deload_week?: number }
  coach_rationale?: string[]
}

export type { ProposalShape }

export function isValidProposal(p: unknown): p is ProposalShape {
  if (!p || typeof p !== 'object') return false
  const o = p as Record<string, unknown>
  if (typeof o.title !== 'string' || typeof o.schema_type !== 'string') return false
  if (typeof o.start_date !== 'string' || typeof o.weeks_planned !== 'number') return false
  if (!Array.isArray(o.workout_schedule) || o.workout_schedule.length === 0) return false
  return o.workout_schedule.every((w) => {
    if (!w || typeof w !== 'object') return false
    const wo = w as Record<string, unknown>
    return typeof wo.day === 'string' && typeof wo.focus === 'string'
  })
}

export function stripStructuredTags(text: string): string {
  return text
    .replace(/<block_proposal>[\s\S]*?<\/block_proposal>/gi, '')
    .replace(/<block_proposal>[\s\S]*/gi, '')
    .replace(/<program_audit>[\s\S]*?<\/program_audit>/gi, '')
    .replace(/<program_audit>[\s\S]*/gi, '')
    .replace(/<current_proposal>[\s\S]*?<\/current_proposal>/gi, '')
    .replace(/<current_proposal>[\s\S]*/gi, '')
    .replace(/```(?:json)?[\s\S]*?```/gi, '')
    .replace(/```[\s\S]*/gi, '')
    .replace(/\[NU VRAGEN\]\s*$/i, '')
    .trim()
}

export function extractAudit(text: string): ProgramAudit | null {
  const match = /<program_audit>([\s\S]*?)<\/program_audit>/i.exec(text)
  if (!match) return null
  try {
    return JSON.parse(match[1].trim()) as ProgramAudit
  } catch {
    return null
  }
}

export interface ParsedResponse {
  proposal: unknown | null
  audit: ProgramAudit | null
  displayText: string
}

export function parseProposalFromStream(acc: string): ParsedResponse {
  let proposal: unknown = null

  const xmlMatch = /<block_proposal>([\s\S]*?)<\/block_proposal>/i.exec(acc)
  if (xmlMatch) {
    try {
      proposal = JSON.parse(xmlMatch[1].trim())
    } catch { /* ignore */ }
  }

  if (proposal === null) {
    const incompleteMatch = /<block_proposal>([\s\S]+)/i.exec(acc)
    if (incompleteMatch) {
      const raw = incompleteMatch[1].trim()
      const cleaned = raw.replace(/<\/block_proposal>\s*$/i, '').trim()
      try {
        const candidate = JSON.parse(cleaned)
        if (isValidProposal(candidate)) proposal = candidate
      } catch { /* ignore */ }
    }
  }

  if (proposal === null) {
    const codeBlocks = Array.from(acc.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi))
    for (const cbMatch of codeBlocks) {
      try {
        const candidate = JSON.parse(cbMatch[1].trim())
        if (isValidProposal(candidate)) {
          proposal = candidate
          break
        }
      } catch { /* ignore */ }
    }
  }

  if (proposal === null) {
    const jsonStart = acc.indexOf('{"title"')
    if (jsonStart >= 0) {
      const jsonEnd = acc.lastIndexOf('}')
      if (jsonEnd > jsonStart) {
        try {
          const candidate = JSON.parse(acc.slice(jsonStart, jsonEnd + 1))
          if (isValidProposal(candidate)) proposal = candidate
        } catch { /* ignore */ }
      }
    }
  }

  const audit = extractAudit(acc)
  const displayText = stripStructuredTags(acc)

  return { proposal, audit, displayText }
}

export function awaitsAnswer(text: string): boolean {
  return /\[NU VRAGEN\]/i.test(text)
}
