import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })

    const admin = createAdminClient()
    const { data: activeSchema, error: activeErr } = await admin
      .from('training_schemas')
      .select('id, source_block_review_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .not('source_block_review_id', 'is', null)
      .maybeSingle()

    if (activeErr) throw activeErr
    if (!activeSchema?.source_block_review_id) {
      return NextResponse.json({ error: 'Geen recent block-review schema om terug te draaien', code: 'NO_UNDO' }, { status: 404 })
    }

    const { data: review, error: reviewErr } = await admin
      .from('block_reviews')
      .select('id, schema_id, next_schema_id, confirmed_at, status')
      .eq('id', activeSchema.source_block_review_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (reviewErr) throw reviewErr
    if (!review || review.next_schema_id !== activeSchema.id || review.status !== 'confirmed') {
      return NextResponse.json({ error: 'Block-review kan niet worden teruggedraaid', code: 'UNDO_INVALID' }, { status: 409 })
    }

    const confirmedAt = review.confirmed_at ? new Date(review.confirmed_at).getTime() : 0
    if (!confirmedAt || Date.now() - confirmedAt > UNDO_WINDOW_MS) {
      return NextResponse.json({ error: 'Undo-window is verlopen', code: 'UNDO_EXPIRED' }, { status: 409 })
    }

    await admin.from('training_schemas').update({ is_active: false }).eq('id', activeSchema.id)
    await admin.from('training_schemas').update({ is_active: true, end_date: null }).eq('id', review.schema_id)
    await admin.from('block_reviews').update({ status: 'reverted', reverted_at: new Date().toISOString() }).eq('id', review.id)
    await admin.from('training_schemas').delete().eq('id', activeSchema.id)

    return NextResponse.json({ success: true, restored_schema_id: review.schema_id })
  } catch (err) {
    console.error('Block review undo error:', err)
    return NextResponse.json({ error: 'Undo mislukt', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
