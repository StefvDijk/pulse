import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSportCorrelations } from '@/lib/load/sport-correlations'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const correlations = await getSportCorrelations(user.id)
    return NextResponse.json(correlations)
  } catch (error) {
    console.error('Sport correlations GET error:', error)
    return NextResponse.json(
      { error: 'Failed to load sport correlations', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
