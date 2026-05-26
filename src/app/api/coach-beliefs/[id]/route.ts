import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const PatchSchema = z.object({
  action: z.enum(['confirm', 'reject']),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid', code: 'VALIDATION_ERROR' }, { status: 400 })

  const { id } = await params
  const nextStatus = parsed.data.action === 'confirm' ? 'confirmed' : 'rejected'
  const nextConfidence = parsed.data.action === 'confirm' ? 1.0 : 0.0

  const { error } = await supabase
    .from('coach_beliefs')
    .update({ status: nextStatus, confidence: nextConfidence })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[PATCH /api/coach-beliefs/:id] failed:', error)
    return NextResponse.json({ error: 'Failed', code: 'UPDATE_FAILED' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
