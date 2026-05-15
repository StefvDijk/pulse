import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { disconnectStrava } from '@/lib/strava/oauth'

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await disconnectStrava(user.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/strava/disconnect] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
