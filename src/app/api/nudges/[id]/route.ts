import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const PatchSchema = z.object({
  status: z.enum(['active', 'dismissed']),
})

/** PATCH /api/nudges/{id} — dismiss (or restore) a nudge. RLS scopes to the user. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', code: 'BAD_REQUEST' }, { status: 400 })
  }

  const { error } = await supabase
    .from('nudges')
    .update({ status: parsed.data.status })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[PATCH /api/nudges/[id]] failed:', error)
    return NextResponse.json({ error: 'Failed to update nudge', code: 'UPDATE_FAILED' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
