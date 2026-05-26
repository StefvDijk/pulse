import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { runBeliefExtractor } from '@/lib/ai/belief-extractor'

const AnswerSchema = z.object({
  answer_text: z.string().min(1).max(2000),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })

  const body = await req.json()
  const parsed = AnswerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const { id } = await params

  const { data: question, error: qErr } = await supabase
    .from('coach_questions')
    .select('id, question_text, related_belief_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (qErr || !question) {
    return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const nowIso = new Date().toISOString()
  const { error: updErr } = await supabase
    .from('coach_questions')
    .update({ status: 'answered', answer_text: parsed.data.answer_text, answered_at: nowIso })
    .eq('id', id)
    .eq('user_id', user.id)

  if (updErr) {
    return NextResponse.json({ error: 'Failed to save', code: 'UPDATE_FAILED' }, { status: 500 })
  }

  // Mark the matching inbox card as actioned (fire-and-forget)
  await supabase
    .from('coach_inbox')
    .update({ status: 'actioned' })
    .eq('user_id', user.id)
    .eq('related_entity_id', id)

  // Feed the answer to belief-extractor so the answered question becomes evidence
  runBeliefExtractor({
    userId: user.id,
    scope: 'lifestyle',
    eventSummary: `Coach vroeg: "${question.question_text}". Stef antwoordde: "${parsed.data.answer_text.slice(0, 800)}". Gerelateerde belief: ${question.related_belief_id ?? 'geen'}.`,
  }).catch(console.error)

  return NextResponse.json({ ok: true })
}
