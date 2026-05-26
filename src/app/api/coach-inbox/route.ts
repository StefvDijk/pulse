import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })

  const { data, error } = await supabase
    .from('coach_inbox')
    .select('id, message_text, type, priority, requires_response, status, related_entity_id, created_at')
    .eq('user_id', user.id)
    .in('status', ['unread', 'read'])
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[GET /api/coach-inbox] failed:', error)
    return NextResponse.json({ error: 'Failed to load inbox', code: 'QUERY_FAILED' }, { status: 500 })
  }

  const unreadCount = (data ?? []).filter((row) => row.status === 'unread').length
  return NextResponse.json({ items: data ?? [], unreadCount })
}
