import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { todayAmsterdam } from '@/lib/time/amsterdam'
import { aggregateBlockData } from '@/lib/block-review/aggregator'
import type { Json } from '@/types/database'
import { buildProgramSchemaRow, validateProgramProposalForUser } from '@/lib/training/program-save'

const ConfirmSchema = z.object({
  schema_id: z.string().uuid(),
  end_reason: z.enum(['completed', 'switched', 'injury', 'goal_reached', 'time_up']),
  reflection: z.object({
    templateRatings: z.array(
      z.object({
        focus: z.string(),
        rating: z.enum(['good', 'ok', 'meh']).nullable(),
        note: z.string(),
      }).passthrough(),
    ),
    keepExercises: z.array(z.string()),
    dropExercises: z.array(z.string()),
    biggestWin: z.string(),
    biggestMiss: z.string(),
    injuryUpdates: z.record(
      z.string(),
      z.enum(['still_active', 'resolved', 'verbeterd', 'stabiel', 'verergerd', 'flare_up_gehad', 'opgelost']),
    ),
  }).passthrough(),
  new_in_body: z
    .object({
      measuredAt: z.string(),
      weightKg: z.number().nullable(),
      skeletalMuscleMassKg: z.number().nullable(),
      fatMassKg: z.number().nullable(),
      fatPct: z.number().nullable(),
      visceralFatLevel: z.number().nullable(),
      waistCm: z.number().nullable(),
    })
    .nullable(),
  ai_analysis: z.string(),
  ai_schema_proposal: z.unknown().nullable(),
  new_schema: z.unknown().nullable(),
  selected_goal_ids: z.array(z.string().uuid()),
  dry_run: z.boolean().default(false),
})

const FinalizeResultSchema = z.object({
  review_id: z.string().uuid(),
  new_schema_id: z.string().uuid(),
  already_confirmed: z.boolean(),
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })

    const body = await request.json()
    const parsed = ConfirmSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    if (parsed.data.dry_run) {
      return NextResponse.json({ success: true, dry_run: true })
    }

    if (!parsed.data.new_schema) {
      return NextResponse.json(
        { error: 'Een opvolgend schema is verplicht', code: 'NEW_SCHEMA_REQUIRED' },
        { status: 422 },
      )
    }

    const admin = createAdminClient()
    const {
      schema_id,
      end_reason,
      reflection,
      new_in_body,
      ai_analysis,
      ai_schema_proposal,
      new_schema,
      selected_goal_ids,
    } = parsed.data

    const { data: owned } = await admin
      .from('training_schemas')
      .select('id, workout_schedule')
      .eq('id', schema_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!owned) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
    }

    // 1) Aggregate snapshot for the snapshot fields
    const aggregate = await aggregateBlockData(admin, user.id, schema_id)
    const validation = await validateProgramProposalForUser({
      admin,
      userId: user.id,
      proposal: new_schema,
      previousScheduleRaw: owned.workout_schedule,
      acwrWeekEnd: aggregate.schema.endDate,
    })
    if (validation.audit.hasBlockers) {
      return NextResponse.json(
        { error: 'Schema bevat blockers', code: 'PROGRAM_AUDIT_BLOCKED', audit: validation.audit },
        { status: 422 },
      )
    }

    // 2) Keep at most one idempotent draft per source schema. The RPC below is
    // the only operation allowed to mark it confirmed.
    const reviewValues = {
      user_id: user.id,
      schema_id,
      period_start: aggregate.schema.startDate,
      period_end: aggregate.schema.endDate,
      status: 'draft',
      end_reason,
      template_ratings: reflection.templateRatings as unknown as Json,
      keep_exercises: reflection.keepExercises,
      drop_exercises: reflection.dropExercises,
      biggest_win: reflection.biggestWin || null,
      biggest_miss: reflection.biggestMiss || null,
      injury_updates: reflection.injuryUpdates as unknown as Json,
      exercise_verdicts: ((reflection as { exerciseVerdicts?: unknown }).exerciseVerdicts ?? []) as unknown as Json,
      missed_sessions: ((reflection as { missedSessions?: unknown }).missedSessions ?? []) as unknown as Json,
      performance_snapshot: {
        totals: aggregate.totals,
        templateAdherence: aggregate.templateAdherence,
        weeklyMuscleVolume: aggregate.weeklyMuscleVolume,
        movementPatternVolume: aggregate.movementPatternVolume,
        sportBreakdown: aggregate.sportBreakdown,
        sportLoadTrend: aggregate.sportLoadTrend,
        exerciseProgressions: aggregate.exerciseProgressions,
        personalRecords: aggregate.personalRecords,
      } as unknown as Json,
      body_snapshot: {
        timeline: aggregate.bodyTimeline,
        delta: aggregate.bodyDelta,
      } as unknown as Json,
      ai_analysis,
      ai_schema_proposal: (ai_schema_proposal ?? null) as Json | null,
      trainer_audit: validation.audit as unknown as Json,
    }

    const { data: existingReview, error: existingReviewError } = await admin
      .from('block_reviews')
      .select('id, status, next_schema_id')
      .eq('user_id', user.id)
      .eq('schema_id', schema_id)
      .in('status', ['draft', 'confirmed'])
      .maybeSingle()
    if (existingReviewError) throw existingReviewError

    if (existingReview?.status === 'confirmed' && existingReview.next_schema_id) {
      return NextResponse.json({
        success: true,
        review_id: existingReview.id,
        new_schema_id: existingReview.next_schema_id,
        already_confirmed: true,
      })
    }

    const review = existingReview
      ? (
          await admin
            .from('block_reviews')
            .update(reviewValues)
            .eq('id', existingReview.id)
            .eq('status', 'draft')
            .select('id')
            .single()
        )
      : await admin.from('block_reviews').insert(reviewValues).select('id').single()
    if (review.error || !review.data) {
      throw review.error ?? new Error('block_review draft save failed')
    }

    // 3) Finalize every correctness-critical write in one database transaction.
    const schemaRow = buildProgramSchemaRow({
      userId: user.id,
      proposal: validation.proposal,
      audit: validation.audit,
      plannedWeeklyLoad: validation.plannedWeeklyLoad,
      sourceBlockReviewId: review.data.id,
      generationContext: `Block review ${review.data.id}`,
    })
    const bodyMeasurement = new_in_body
      ? {
          date: new_in_body.measuredAt,
          weight_kg: new_in_body.weightKg,
          skeletal_muscle_mass_kg: new_in_body.skeletalMuscleMassKg,
          fat_mass_kg: new_in_body.fatMassKg,
          fat_pct: new_in_body.fatPct,
          visceral_fat_level: new_in_body.visceralFatLevel,
          waist_cm: new_in_body.waistCm,
        }
      : null
    const summary = {
      summary: `Block review afgesloten — ${aggregate.totals.completedSessions}/${aggregate.totals.plannedSessions} sessies (${aggregate.totals.adherencePct ?? '?'}%). Eindstatus: ${end_reason}.`,
      exercises_used: Array.from(new Set(aggregate.exerciseProgressions.map((e) => e.exerciseName))).slice(0, 50),
      adherence_percentage: aggregate.totals.adherencePct,
      total_sessions_planned: aggregate.totals.plannedSessions,
      total_sessions_completed: aggregate.totals.completedSessions,
      end_reason,
    }
    const { data: finalizedRaw, error: finalizeError } = await admin.rpc('finalize_block_review_v2', {
      p_user_id: user.id,
      p_review_id: review.data.id,
      p_previous_schema_id: schema_id,
      p_previous_end_date: aggregate.schema.endDate,
      p_review: reviewValues as unknown as Json,
      p_schema: schemaRow as unknown as Json,
      p_body_measurement: bodyMeasurement as unknown as Json,
      p_summary: summary as unknown as Json,
      p_new_goal_ids: selected_goal_ids,
    })
    if (finalizeError) throw finalizeError
    const finalized = FinalizeResultSchema.parse(finalizedRaw)

    // 7) Coaching memory entries for learnings
    if (reflection.biggestWin) {
      await admin.from('coaching_memory').upsert(
        {
          user_id: user.id,
          key: `block_win_${todayAmsterdam()}`,
          category: 'program',
          value: `Grootste win blok "${aggregate.schema.title}": ${reflection.biggestWin}`,
        },
        { onConflict: 'user_id,key' },
      )
    }
    if (reflection.biggestMiss) {
      await admin.from('coaching_memory').upsert(
        {
          user_id: user.id,
          key: `block_miss_${todayAmsterdam()}`,
          category: 'program',
          value: `Grootste miss blok "${aggregate.schema.title}": ${reflection.biggestMiss}`,
        },
        { onConflict: 'user_id,key' },
      )
    }

    return NextResponse.json({
      success: true,
      review_id: finalized.review_id,
      new_schema_id: finalized.new_schema_id,
      already_confirmed: finalized.already_confirmed,
    })
  } catch (err) {
    console.error('Block review confirm error:', err)
    return NextResponse.json({ error: 'Failed to confirm block review', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
