import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('weekly_lessons')
      .select('id, week_start, lesson_text, category, created_at')
      .eq('user_id', user.id)
      .order('week_start', { ascending: false })
      .limit(52)

    if (error) throw error

    return NextResponse.json({ lessons: data ?? [] })
  } catch (error) {
    console.error('Weekly lessons GET error:', error)
    return NextResponse.json(
      { error: 'Failed to load weekly lessons', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
