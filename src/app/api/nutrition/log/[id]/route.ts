import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recomputeDailyNutritionSummary } from '@/lib/nutrition/summary'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const { id } = await params
    const admin = createAdminClient()

    const { data: existing, error: lookupError } = await admin
      .from('nutrition_logs')
      .select('id, date')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (lookupError) throw lookupError
    if (!existing) {
      return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    const { error: deleteError } = await admin
      .from('nutrition_logs')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) throw deleteError

    await recomputeDailyNutritionSummary(user.id, existing.date)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Nutrition delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete nutrition log', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
