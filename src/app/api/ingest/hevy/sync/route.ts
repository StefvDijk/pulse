import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncHevyWorkouts } from '@/lib/hevy/sync'

export async function POST(): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const result = await syncHevyWorkouts(user.id)

    return NextResponse.json(result)
  } catch (error) {
    console.error('[POST /api/ingest/hevy/sync]', error)
    const message = error instanceof Error ? error.message : 'Unexpected error during Hevy sync'
    return NextResponse.json({ error: message, code: 'SYNC_FAILED' }, { status: 500 })
  }
}
