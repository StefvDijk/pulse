import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { todayAmsterdam } from '@/lib/time/amsterdam'
import { aggregateBlockData } from '@/lib/block-review/aggregator'
import type { Json } from '@/types/database'
import { insertProgramSchema, validateProgramProposalForUser, type ProgramValidationResult } from '@/lib/training/program-save'

const ConfirmSchema = z.object({
  schema_id: z.string().uuid(),
  end_reason: z.enum(['completed', 'switched', 'injury', 'goal_reached', 'time_up']),
  reflection: z.object({
    templateRatings: z.array(
      z.object({
        focus: z.string(),
        rating: z.enum(['good', 'ok', 'meh']).nullable(),
        note: z.string(),
      }),
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
    let validation: ProgramValidationResult | null = null
    if (new_schema) {
      validation = await validateProgramProposalForUser({
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
    }

    // 2) Insert block_review row (status confirmed)
    const { data: review, error: reviewErr } = await admin
      .from('block_reviews')
      .insert({
        user_id: user.id,
        schema_id,
        period_start: aggregate.schema.startDate,
        period_end: aggregate.schema.endDate,
        status: 'confirmed',
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
        trainer_audit: (validation?.audit ?? {}) as unknown as Json,
        confirmed_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (reviewErr || !review) throw reviewErr ?? new Error('block_review insert failed')

    // 3) Save InBody measurement if present
    if (new_in_body) {
      await admin.from('body_composition_logs').insert({
        user_id: user.id,
        date: new_in_body.measuredAt,
        weight_kg: new_in_body.weightKg,
        skeletal_muscle_mass_kg: new_in_body.skeletalMuscleMassKg,
        fat_mass_kg: new_in_body.fatMassKg,
        fat_pct: new_in_body.fatPct,
        visceral_fat_level: new_in_body.visceralFatLevel,
        waist_cm: new_in_body.waistCm,
        source: 'manual',
      })
    }

    // 4) Insert new schema first (is_active=false). If this fails, old schema stays active.
    let newSchemaId: string | null = null
    if (validation) {
      newSchemaId = await insertProgramSchema({
        admin,
        userId: user.id,
        proposal: validation.proposal,
        audit: validation.audit,
        plannedWeeklyLoad: validation.plannedWeeklyLoad,
        sourceBlockReviewId: review.id,
        generationContext: `Block review ${review.id}`,
        isActive: false,
      })
    }

    // 5) Write summary row for old schema (non-fatal)
    const { error: summaryErr } = await admin.from('schema_block_summaries').insert({
      user_id: user.id,
      schema_id,
      summary: `Block review afgesloten — ${aggregate.totals.completedSessions}/${aggregate.totals.plannedSessions} sessies (${aggregate.totals.adherencePct ?? '?'}%). Eindstatus: ${end_reason}.`,
      exercises_used: Array.from(new Set(aggregate.exerciseProgressions.map((e) => e.exerciseName))).slice(0, 50),
      adherence_percentage: aggregate.totals.adherencePct,
      total_sessions_planned: aggregate.totals.plannedSessions,
      total_sessions_completed: aggregate.totals.completedSessions,
      end_reason,
    })
    if (summaryErr) console.error('schema_block_summaries insert failed (non-fatal):', summaryErr)

    // 6) Deactivate old schema, deactivate any leftover actives, activate new schema
    await admin
      .from('training_schemas')
      .update({ end_date: aggregate.schema.endDate, is_active: false })
      .eq('id', schema_id)

    if (newSchemaId) {
      await admin
        .from('training_schemas')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true)
        .neq('id', newSchemaId)
      await admin.from('training_schemas').update({ is_active: true }).eq('id', newSchemaId)
    }

    // 6) Update block_review with next_schema_id + goal ids
    await admin
      .from('block_reviews')
      .update({ next_schema_id: newSchemaId, new_goal_ids: selected_goal_ids })
      .eq('id', review.id)

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

    return NextResponse.json({ success: true, review_id: review.id, new_schema_id: newSchemaId })
  } catch (err) {
    console.error('Block review confirm error:', err)
    return NextResponse.json({ error: 'Failed to confirm block review', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
