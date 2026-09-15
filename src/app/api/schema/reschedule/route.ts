import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseScheduleTemplates, parseScheduledOverrides, resolveScheduledSession } from '@/lib/training/scheduled-session'

const RescheduleSchema = z.object({
  fromDate: z.iso.date(),
  toDate: z.iso.date(),
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

    const { data: schema, error: schemaError } = await admin
      .from('training_schemas')
      .select('id, scheduled_overrides, workout_schedule, updated_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (schemaError) throw schemaError
    if (!schema) {
      return NextResponse.json({ error: 'No active training schema', code: 'NO_SCHEMA' }, { status: 404 })
    }

    const schedule = parseScheduleTemplates(schema.workout_schedule)
    const existing = parseScheduledOverrides(schema.scheduled_overrides)
    const dayName = (date:string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US',{weekday:'long',timeZone:'UTC'}).toLowerCase()
    const session = resolveScheduledSession(schedule,existing,fromDate,dayName(fromDate))
    if (!session || session.sport_type === 'rest' || session.focus !== workoutFocus) {
      return NextResponse.json({error:'De training is gewijzigd. Vernieuw je schema.',code:'SCHEMA_CHANGED'},{status:409})
    }
    const destination = resolveScheduledSession(schedule,existing,toDate,dayName(toDate))
    if (destination && destination.sport_type !== 'rest') {
      return NextResponse.json({error:'Op deze dag staat al een training.',code:'DESTINATION_OCCUPIED'},{status:409})
    }
    // Carry the resolved contents, not just a label that loses personal edits.
    const updated = {
      ...existing,
      [fromDate]: null,           // Original date becomes rest
      [toDate]: session,
    }

    const update = admin
      .from('training_schemas')
      .update({ scheduled_overrides: updated as unknown as import('@/types/database').Json, updated_at:new Date().toISOString() })
      .eq('id', schema.id)
      .eq('user_id',user.id)
      .eq('is_active',true)
    const guardedUpdate = schema.updated_at === null
      ? update.is('updated_at',null)
      : update.eq('updated_at',schema.updated_at)
    const {data:saved,error:updateError} = await guardedUpdate.select('id').maybeSingle()

    if (updateError) throw updateError
    if (!saved) return NextResponse.json({error:'Het schema is ondertussen gewijzigd. Vernieuw en probeer opnieuw.',code:'SCHEMA_CHANGED'},{status:409})

    return NextResponse.json({
      success: true,
      message: `${workoutFocus} verplaatst van ${fromDate} naar ${toDate}`,
    })
  } catch (err) {
    console.error('Reschedule API error:', err)
    return NextResponse.json({ error: 'Failed to reschedule', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
