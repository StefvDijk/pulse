import type { LiveCoachId } from '@/lib/ai/coaches/registry'

/** A persisted, deterministic, coach-scoped nudge (issue #42). */
export interface Nudge {
  id: string
  coach_id: LiveCoachId
  trigger_type: string
  severity: 'low' | 'medium' | 'high'
  body: string
  cta_label: string | null
  cta_href: string | null
  status: 'active' | 'dismissed'
  created_at: string
}

export interface NudgesResponse {
  nudges: Nudge[]
}
