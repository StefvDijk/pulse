import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toJson } from '@/lib/schemas/db/json'

const RescheduleSchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  workoutFocus: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = RescheduleSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { fromDate, toDate, workoutFocus } = parsed.data

    if (fromDate === toDate) {
      return NextResponse.json({ error: 'Dates are the same', code: 'SAME_DATE' }, { status: 400 })
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

    // Merge new overrides with existing ones
    const existing = (schema.scheduled_overrides as Record<string, string | null>) ?? {}
    const updated = {
      ...existing,
      [fromDate]: null,           // Original date becomes rest
      [toDate]: workoutFocus,     // New date gets the workout
    }

    const { error: updateError } = await admin
      .from('training_schemas')
      .update({ scheduled_overrides: toJson(updated) })
      .eq('id', schema.id)

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      message: `${workoutFocus} verplaatst van ${fromDate} naar ${toDate}`,
    })
  } catch (err) {
    console.error('Reschedule API error:', err)
    return NextResponse.json({ error: 'Failed to reschedule', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
