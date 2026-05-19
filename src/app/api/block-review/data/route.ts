import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aggregateBlockData } from '@/lib/block-review/aggregator'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })

    const url = new URL(request.url)
    const requestedSchemaId = url.searchParams.get('schema_id')

    const admin = createAdminClient()
    let schemaId = requestedSchemaId
    if (!schemaId) {
      const { data: active } = await admin
        .from('training_schemas')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()
      if (!active) return NextResponse.json({ error: 'No active schema', code: 'NO_SCHEMA' }, { status: 404 })
      schemaId = active.id
    }

    const data = await aggregateBlockData(admin, user.id, schemaId)
    return NextResponse.json(data)
  } catch (err) {
    console.error('Block review data error:', err)
    return NextResponse.json({ error: 'Failed to load block review data', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
