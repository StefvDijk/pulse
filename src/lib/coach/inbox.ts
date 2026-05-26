import { createAdminClient } from '@/lib/supabase/admin'

export type InboxType =
  | 'anomaly'
  | 'mid_block'
  | 'morning_readiness'
  | 'belief_question'
  | 'post_workout'
  | 'coach_question'

export type InboxPriority = 'low' | 'medium' | 'high'

export interface EnqueueInboxItemInput {
  userId: string
  type: InboxType
  messageText: string
  priority?: InboxPriority
  requiresResponse?: boolean
  relatedEntityId?: string
}

const REQUIRES_RESPONSE_DEFAULT: Record<InboxType, boolean> = {
  anomaly: false,
  mid_block: true,
  morning_readiness: false,
  belief_question: true,
  post_workout: true,
  coach_question: true,
}

export async function enqueueInboxItem(input: EnqueueInboxItemInput): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from('coach_inbox').insert({
    user_id: input.userId,
    type: input.type,
    message_text: input.messageText.slice(0, 1000),
    priority: input.priority ?? 'medium',
    requires_response: input.requiresResponse ?? REQUIRES_RESPONSE_DEFAULT[input.type],
    status: 'unread',
    related_entity_id: input.relatedEntityId ?? null,
  })
  if (error) console.error('[inbox] enqueue failed:', error)
}
