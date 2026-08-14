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

    const { error: undoError } = await admin.rpc('undo_chat_nutrition_log', {
      p_user_id: user.id,
      p_log_id: id,
    })
    if (undoError) {
      if (undoError.message.includes('Nutrition log not found')) {
        return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
      }
      throw undoError
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Nutrition delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete nutrition log', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
