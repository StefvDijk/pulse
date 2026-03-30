import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')

    if (sessionId) {
      // Fetch messages for specific session
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('id, role, content, message_type, created_at')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(50)

      if (error) throw error

      return NextResponse.json({ session_id: sessionId, messages: messages ?? [] })
    }

    // No session_id: return most recent session or null
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('id, title, started_at, last_message_at, message_count')
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!session) {
      return NextResponse.json({ session_id: null, messages: [] })
    }

    const { data: messages } = await supabase
      .from('chat_messages')
      .select('id, role, content, message_type, created_at')
      .eq('session_id', session.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(50)

    return NextResponse.json({
      session_id: session.id,
      session,
      messages: messages ?? [],
    })
  } catch (error) {
    console.error('Chat history error:', error)
    return NextResponse.json(
      { error: 'Failed to load chat history', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
