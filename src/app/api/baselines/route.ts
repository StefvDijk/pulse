import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAllLatestBaselines } from '@/lib/baselines/lookup'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const baselines = await getAllLatestBaselines(user.id)
    return NextResponse.json({ baselines })
  } catch (error) {
    console.error('Baselines GET error:', error)
    return NextResponse.json(
      { error: 'Failed to load baselines', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
