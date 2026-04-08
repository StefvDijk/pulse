import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'

/* ── Schema ──────────────────────────────────────────────── */

// Each value: a workout focus string, or null for explicit rest day,
// or undefined to fall back on the template (handled via the omit endpoint below).
const OverridesSchema = z.object({
  overrides: z.record(
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    z.union([z.string().min(1).max(60), z.null()]),
  ),
  // Optional: dates to remove from overrides entirely (revert to template).
  clear: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
})

/* ── POST: Bulk merge overrides ──────────────────────────── */

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = OverridesSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    const { data: schema } = await admin
      .from('training_schemas')
      .select('id, scheduled_overrides')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!schema) {
      return NextResponse.json({ error: 'No active training schema', code: 'NO_SCHEMA' }, { status: 404 })
    }

    // Merge: existing → new overrides → drop any "clear" dates
    const existing = (schema.scheduled_overrides as Record<string, string | null>) ?? {}
    const merged: Record<string, string | null> = { ...existing, ...parsed.data.overrides }

    if (parsed.data.clear) {
      for (const date of parsed.data.clear) {
        delete merged[date]
      }
    }

    const { error: updateError } = await admin
      .from('training_schemas')
      .update({ scheduled_overrides: merged as unknown as Json })
      .eq('id', schema.id)

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      overridesCount: Object.keys(merged).length,
    })
  } catch (err) {
    console.error('Schema overrides API error:', err)
    return NextResponse.json({ error: 'Failed to update overrides', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
