import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    await admin
      .from('user_settings')
      .update({
        google_calendar_access_token: null,
        google_calendar_refresh_token: null,
        google_calendar_token_expiry: null,
        google_calendar_email: null,
      })
      .eq('user_id', user.id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[POST /api/calendar/disconnect] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
