import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import { addDaysToKey, todayAmsterdam } from '@/lib/time/amsterdam'
import { computeACWR, projectACWR, type PlannedSessionLoad } from './acwr'
import { exerciseNamesFromSchedule, resolveExerciseMetadata } from './exercise-lookup'
import { ProgramProposalV2Schema, type ProgramProposalV2, type ProgramSession } from './program-contract'
import { auditProgramProposal, type ProgramAudit } from './program-quality'

type Admin = SupabaseClient<Database>

export interface ProgramValidationResult {
  proposal: ProgramProposalV2
  audit: ProgramAudit
  plannedWeeklyLoad: {
    currentACWR: number | null
    projectedACWR: number | null
    plannedLoads: PlannedSessionLoad[]
  }
}

export interface SaveProgramSchemaParams {
  admin: Admin
  userId: string
  proposal: ProgramProposalV2
  audit: ProgramAudit
  plannedWeeklyLoad: ProgramValidationResult['plannedWeeklyLoad']
  sourceBlockReviewId?: string | null
  generationContext?: string | null
  isActive?: boolean
}

function normaliseSportType(focus: string): 'gym' | 'run' | 'padel' | 'rest' {
  const f = focus.toLowerCase()
  if (f.includes('rust') || f.includes('rest')) return 'rest'
  if (f.includes('hardlopen') || f.includes('run')) return 'run'
  if (f.includes('padel')) return 'padel'
  return 'gym'
}

export function legacyScheduleToProgramSessions(raw: unknown): ProgramSession[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((session): session is Record<string, unknown> => !!session && typeof session === 'object')
    .map((session) => {
      const focus = typeof session.focus === 'string' ? session.focus : 'Training'
      const sportType =
        session.sport_type === 'gym' ||
        session.sport_type === 'run' ||
        session.sport_type === 'padel' ||
        session.sport_type === 'rest'
          ? session.sport_type
          : normaliseSportType(focus)
      const exercises = Array.isArray(session.exercises)
        ? session.exercises
            .filter((exercise): exercise is Record<string, unknown> => !!exercise && typeof exercise === 'object')
            .map((exercise) => ({
              name: typeof exercise.name === 'string' ? exercise.name : 'Unknown',
              sets: typeof exercise.sets === 'number' ? exercise.sets : 1,
              reps: typeof exercise.reps === 'string' ? exercise.reps : 'n.v.t.',
              rest_seconds: typeof exercise.rest_seconds === 'number' ? exercise.rest_seconds : 60,
              rpe:
                typeof exercise.rpe === 'string'
                  ? exercise.rpe
                  : typeof exercise.rpe === 'number'
                    ? String(exercise.rpe)
                    : 'n.v.t.',
              notes: typeof exercise.notes === 'string' && exercise.notes.trim() ? exercise.notes : 'Vorig schema.',
              primary_muscle_group:
                typeof exercise.primary_muscle_group === 'string' ? exercise.primary_muscle_group : undefined,
              movement_pattern:
                typeof exercise.movement_pattern === 'string' ? exercise.movement_pattern : undefined,
            }))
        : []

      return {
        day: typeof session.day === 'string' ? session.day : 'monday',
        focus,
        sport_type: sportType,
        run_type:
          session.run_type === 'easy' ||
          session.run_type === 'interval' ||
          session.run_type === 'tempo' ||
          session.run_type === 'long'
            ? session.run_type
            : undefined,
        duration_min: typeof session.duration_min === 'number' ? session.duration_min : sportType === 'rest' ? 1 : 55,
        exercises,
        estimated_tonnage_kg:
          typeof session.estimated_tonnage_kg === 'number' ? session.estimated_tonnage_kg : undefined,
        estimated_load_au: typeof session.estimated_load_au === 'number' ? session.estimated_load_au : undefined,
      } as ProgramSession
    })
}

function plannedLoadsForProposal(proposal: ProgramProposalV2): PlannedSessionLoad[] {
  return proposal.workout_schedule
    .filter((session) => session.sport_type !== 'rest')
    .map((session) => ({
      type: session.sport_type as PlannedSessionLoad['type'],
      estimatedMinutes: session.duration_min,
    }))
}

export async function validateProgramProposalForUser(params: {
  admin: Admin
  userId: string
  proposal: unknown
  previousScheduleRaw?: unknown
  acwrWeekEnd?: string
}): Promise<ProgramValidationResult> {
  const parsed = ProgramProposalV2Schema.parse(params.proposal)
  const previousSchedule = legacyScheduleToProgramSessions(params.previousScheduleRaw)
  const names = [
    ...exerciseNamesFromSchedule(parsed.workout_schedule),
    ...exerciseNamesFromSchedule(previousSchedule),
  ]
  const exerciseMetadata = await resolveExerciseMetadata(params.admin, names)

  let currentACWR: number | null = null
  let projectedACWR: number | null = null
  let hasEnoughLoadHistory = false
  const plannedLoads = plannedLoadsForProposal(parsed)

  try {
    const weekEnd = params.acwrWeekEnd ?? addDaysToKey(todayAmsterdam(), -1)
    const current = await computeACWR(params.userId, weekEnd)
    const projected = projectACWR(current, plannedLoads)
    currentACWR = current.ratio
    projectedACWR = projected.ratio
    hasEnoughLoadHistory = current.daysCounted >= 8
  } catch (err) {
    console.error('[program-validate] ACWR projection failed (non-fatal):', err)
  }

  const audit = auditProgramProposal(parsed, {
    previousSchedule,
    currentACWR,
    projectedACWR,
    hasEnoughLoadHistory,
    exerciseMetadata,
  })

  return {
    proposal: parsed,
    audit,
    plannedWeeklyLoad: {
      currentACWR,
      projectedACWR,
      plannedLoads,
    },
  }
}

export async function insertProgramSchema({
  admin,
  userId,
  proposal,
  audit,
  plannedWeeklyLoad,
  sourceBlockReviewId,
  generationContext,
  isActive = false,
}: SaveProgramSchemaParams): Promise<string> {
  const { data, error } = await admin
    .from('training_schemas')
    .insert({
      user_id: userId,
      title: proposal.title,
      schema_type: proposal.schema_type,
      weeks_planned: proposal.weeks_planned,
      start_date: proposal.start_date,
      workout_schedule: proposal.workout_schedule as unknown as Json,
      progression_rules: proposal.progression as unknown as Json,
      quality_audit: audit as unknown as Json,
      planned_weekly_load: plannedWeeklyLoad as unknown as Json,
      source_block_review_id: sourceBlockReviewId ?? null,
      is_active: isActive,
      ai_generated: true,
      generation_context: generationContext ?? null,
    })
    .select('id')
    .single()

  if (error || !data) throw error ?? new Error('training_schemas insert returned no row')
  return data.id
}
