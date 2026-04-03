import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database, Json } from '@/types/database'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const InBodyDataSchema = z.object({
  weight_kg: z.number().positive().optional(),
  fat_pct: z.number().min(0).max(100).optional(),
  fat_mass_kg: z.number().min(0).optional(),
  muscle_mass_kg: z.number().positive().optional(),
  waist_cm: z.number().positive().optional(),
})

const ConfirmRequestSchema = z.object({
  week_start: z.string().date(),
  week_end: z.string().date(),
  week_number: z.number().int().min(1).max(53),
  summary_text: z.string().min(1).max(2000),
  key_insights: z.array(z.string()).min(1).max(10),
  focus_next_week: z.string().min(1).max(500),
  sessions_planned: z.number().int().min(0).nullable().optional(),
  sessions_completed: z.number().int().min(0).nullable().optional(),
  highlights: z.unknown().optional(),
  manual_additions: z.unknown().optional(),
  inbody_data: InBodyDataSchema.optional(),
})

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = ConfirmRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', code: 'BAD_REQUEST', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const input = parsed.data

    // Build the review record
    const inbody = input.inbody_data
    const reviewRecord: Database['public']['Tables']['weekly_reviews']['Insert'] = {
      user_id: user.id,
      week_start: input.week_start,
      week_end: input.week_end,
      week_number: input.week_number,
      summary_text: input.summary_text,
      sessions_planned: input.sessions_planned ?? null,
      sessions_completed: input.sessions_completed ?? null,
      highlights: (input.highlights as Json) ?? null,
      manual_additions: (input.manual_additions as Json) ?? null,
      next_week_plan: { focusNextWeek: input.focus_next_week, keyInsights: input.key_insights },
      completed_at: new Date().toISOString(),
      inbody_weight_kg: inbody?.weight_kg ?? null,
      inbody_fat_pct: inbody?.fat_pct ?? null,
      inbody_fat_mass_kg: inbody?.fat_mass_kg ?? null,
      inbody_muscle_mass_kg: inbody?.muscle_mass_kg ?? null,
      inbody_waist_cm: inbody?.waist_cm ?? null,
    }

    // Upsert weekly_reviews (onConflict: user_id, week_start)
    const { data: review, error: reviewError } = await admin
      .from('weekly_reviews')
      .upsert(reviewRecord, { onConflict: 'user_id,week_start' })
      .select()
      .single()

    if (reviewError) throw reviewError

    // If InBody data provided, also upsert body_composition_logs (non-fatal)
    if (input.inbody_data) {
      try {
        await admin
          .from('body_composition_logs')
          .upsert(
            {
              user_id: user.id,
              date: input.week_end,
              source: 'weekly_checkin',
              weight_kg: input.inbody_data.weight_kg ?? null,
              fat_pct: input.inbody_data.fat_pct ?? null,
              fat_mass_kg: input.inbody_data.fat_mass_kg ?? null,
              muscle_mass_kg: input.inbody_data.muscle_mass_kg ?? null,
              waist_cm: input.inbody_data.waist_cm ?? null,
            },
            { onConflict: 'user_id,date,source' },
          )
      } catch (bodyCompError) {
        // Non-fatal: log but do not fail the request
        console.error('Body composition log upsert failed (non-fatal):', bodyCompError)
      }
    }

    // Save key insights to coaching_memory (fire-and-forget)
    saveInsightsToMemory(admin, user.id, input.week_start, input.key_insights, input.focus_next_week)
      .catch((memoryError) => {
        console.error('Coaching memory save failed (non-fatal):', memoryError)
      })

    return NextResponse.json(review, { status: 201 })
  } catch (error) {
    console.error('Check-in confirm POST error:', error)
    return NextResponse.json(
      { error: 'Failed to confirm check-in', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// Fire-and-forget: save insights to coaching memory
// ---------------------------------------------------------------------------

async function saveInsightsToMemory(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  weekStart: string,
  keyInsights: string[],
  focusNextWeek: string,
): Promise<void> {
  const records = [
    ...keyInsights.map((insight, i) => ({
      user_id: userId,
      key: `weekly_insight_w${weekStart}_${i}`,
      category: 'pattern',
      value: insight.slice(0, 500),
      source_date: weekStart,
    })),
    {
      user_id: userId,
      key: `weekly_focus_w${weekStart}`,
      category: 'goal',
      value: focusNextWeek.slice(0, 500),
      source_date: weekStart,
    },
  ]

  await admin
    .from('coaching_memory')
    .upsert(records, { onConflict: 'user_id,key' })
}
