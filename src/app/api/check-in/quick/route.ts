import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { todayAmsterdam } from '@/lib/time/amsterdam'

// 30-second daily check-in (UXR-210). One row per user per Amsterdam-local
// day; upserts on (user_id, date) so the user can revisit and refine an
// earlier-in-the-day rating without creating duplicate rows.

const RequestSchema = z.object({
  feeling: z.number().int().min(1).max(5),
  sleep_quality: z.number().int().min(1).max(5),
  note: z.string().max(280).nullable().optional(),
  /** Optional explicit date (YYYY-MM-DD). Defaults to today in Europe/Amsterdam. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 },
      )
    }

    const body: unknown = await request.json().catch(() => null)
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', code: 'VALIDATION_ERROR', issues: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { feeling, sleep_quality, note } = parsed.data
    const date = parsed.data.date ?? todayAmsterdam()

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('daily_checkins')
      .upsert(
        {
          user_id: user.id,
          date,
          feeling,
          sleep_quality,
          note: note ?? null,
        },
        { onConflict: 'user_id,date' },
      )
      .select('id, date, feeling, sleep_quality, note, updated_at')
      .single()

    if (error || !data) {
      console.error('[check-in/quick] upsert failed:', error)
      return NextResponse.json(
        { error: 'Opslaan mislukt', code: 'DB_ERROR' },
        { status: 500 },
      )
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[check-in/quick] unexpected error:', err)
    return NextResponse.json(
      { error: 'Onverwachte fout', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 },
      )
    }

    const date = todayAmsterdam()
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('daily_checkins')
      .select('id, date, feeling, sleep_quality, note, updated_at')
      .eq('user_id', user.id)
      .eq('date', date)
      .maybeSingle()

    if (error) {
      console.error('[check-in/quick] read failed:', error)
      return NextResponse.json(
        { error: 'Laden mislukt', code: 'DB_ERROR' },
        { status: 500 },
      )
    }

    return NextResponse.json({ date, checkin: data })
  } catch (err) {
    console.error('[check-in/quick GET] unexpected error:', err)
    return NextResponse.json(
      { error: 'Onverwachte fout', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
