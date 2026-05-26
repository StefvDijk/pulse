import { createAdminClient } from '@/lib/supabase/admin'
import { enqueueInboxItem } from '@/lib/coach/inbox'

export interface AskStefInput {
  question: string
  urgency: 'low' | 'medium' | 'high'
  related_belief_id?: string | null
}

const EXPIRES_DAYS: Record<AskStefInput['urgency'], number> = {
  low: 14,
  medium: 7,
  high: 3,
}

export async function askStef(userId: string, input: AskStefInput) {
  const admin = createAdminClient()
  const expiresAt = new Date(Date.now() + EXPIRES_DAYS[input.urgency] * 86_400_000).toISOString()

  const { data, error } = await admin
    .from('coach_questions')
    .insert({
      user_id: userId,
      question_text: input.question.slice(0, 500),
      urgency: input.urgency,
      status: 'pending',
      related_belief_id: input.related_belief_id ?? null,
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[ask_stef] insert failed:', error)
    return { ok: false, error: 'Could not store question' }
  }

  await enqueueInboxItem({
    userId,
    type: 'coach_question',
    messageText: input.question.slice(0, 500),
    priority: input.urgency,
    requiresResponse: true,
    relatedEntityId: data.id,
  })

  return { ok: true, question_id: data.id, expires_at: expiresAt }
}
