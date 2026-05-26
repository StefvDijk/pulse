import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })

  const { data, error } = await supabase
    .from('coach_beliefs')
    .select('id, hypothesis_text, category, confidence, status, evidence_for, evidence_against, last_tested_at, created_at')
    .eq('user_id', user.id)
    .in('status', ['active', 'confirmed'])
    .order('confidence', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[GET /api/coach-beliefs] failed:', error)
    return NextResponse.json({ error: 'Failed', code: 'QUERY_FAILED' }, { status: 500 })
  }

  return NextResponse.json({ beliefs: data ?? [] })
}
