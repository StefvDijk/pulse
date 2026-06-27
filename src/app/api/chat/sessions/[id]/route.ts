import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const { id } = await params
    const admin = createAdminClient()

    // Delete messages first (no reliance on ON DELETE CASCADE), then the session.
    const { error: msgError } = await admin
      .from('chat_messages')
      .delete()
      .eq('session_id', id)
      .eq('user_id', user.id)
    if (msgError) throw msgError

    const { error: sessionError } = await admin
      .from('chat_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (sessionError) throw sessionError

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Chat session delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete session', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
