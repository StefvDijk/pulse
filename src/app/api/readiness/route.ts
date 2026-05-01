import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeReadiness } from '@/lib/aggregations/readiness'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 },
      )
    }
    const data = await computeReadiness(user.id)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Readiness API error:', error)
    return NextResponse.json(
      { error: 'Failed to load readiness data', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
