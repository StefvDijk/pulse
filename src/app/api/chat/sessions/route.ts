import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: sessions, error } = await admin
      .from('chat_sessions')
      .select('id, title, last_message_at, message_count')
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false })
      .limit(100)

    if (error) throw error

    return NextResponse.json({ sessions: sessions ?? [] })
  } catch (error) {
    console.error('Chat sessions list error:', error)
    return NextResponse.json(
      { error: 'Failed to load sessions', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
