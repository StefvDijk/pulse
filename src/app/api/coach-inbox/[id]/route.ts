import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const PatchSchema = z.object({
  status: z.enum(['unread', 'read', 'dismissed', 'actioned']),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const { id } = await params
  const { error } = await supabase
    .from('coach_inbox')
    .update({ status: parsed.data.status })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[PATCH /api/coach-inbox/:id] failed:', error)
    return NextResponse.json({ error: 'Failed to update', code: 'UPDATE_FAILED' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
