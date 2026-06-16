import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  computePendingSessions,
  feedbackKey,
  type RecentSession,
  type SessionFeedbackType,
} from '@/lib/training/session-feedback'

// Sessions trained within this window are eligible for a feedback nudge. Older
// imports (e.g. a first-run backfill) are left alone so we don't nag about
// history the user never asked to comment on.
const WINDOW_DAYS = 7

export interface PendingFeedbackResponse {
  pending: RecentSession[]
}

function runTitle(runType: string | null): string {
  if (!runType) return 'Hardlopen'
  return `${runType.charAt(0).toUpperCase()}${runType.slice(1)} run`
}

function formatKm(meters: number | null): string | null {
  if (meters == null) return null
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`
}

function formatMinutes(seconds: number | null): string | null {
  if (seconds == null) return null
  return `${Math.round(seconds / 60)} min`
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const sinceISO = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString()
    const admin = createAdminClient()

    const [workoutsResult, runsResult, padelResult, handledResult] = await Promise.all([
      admin
        .from('workouts')
        .select(
          `id, title, started_at, exercise_count,
           workout_exercises(exercise_order, exercise_definitions(name))`,
        )
        .eq('user_id', user.id)
        .gte('started_at', sinceISO)
        .order('started_at', { ascending: false }),
      admin
        .from('runs')
        .select('id, started_at, run_type, distance_meters, duration_seconds')
        .eq('user_id', user.id)
        .gte('started_at', sinceISO)
        .order('started_at', { ascending: false }),
      admin
        .from('padel_sessions')
        .select('id, started_at, duration_seconds')
        .eq('user_id', user.id)
        .gte('started_at', sinceISO)
        .order('started_at', { ascending: false }),
      admin
        .from('session_feedback')
        .select('session_type, session_id')
        .eq('user_id', user.id)
        .gte('session_started_at', sinceISO),
    ])

    if (workoutsResult.error) throw workoutsResult.error
    if (runsResult.error) throw runsResult.error
    if (padelResult.error) throw padelResult.error
    if (handledResult.error) throw handledResult.error

    const gym: RecentSession[] = (workoutsResult.data ?? []).map((w) => {
      const seen = new Set<number>()
      const exercises = [...(w.workout_exercises ?? [])]
        .sort((a, b) => a.exercise_order - b.exercise_order)
        .filter((we) => {
          if (seen.has(we.exercise_order)) return false
          seen.add(we.exercise_order)
          const name = we.exercise_definitions?.name?.toLowerCase() ?? ''
          return !name.includes('warm up') && !name.includes('warmup')
        })
        .map((we) => we.exercise_definitions?.name ?? 'Onbekend')
      return {
        session_type: 'gym' as const,
        session_id: w.id,
        title: w.title,
        started_at: w.started_at,
        subtitle: exercises.length > 0 ? `${exercises.length} oefeningen` : null,
        exercises,
      }
    })

    const runs: RecentSession[] = (runsResult.data ?? []).map((r) => ({
      session_type: 'run' as const,
      session_id: r.id,
      title: runTitle(r.run_type),
      started_at: r.started_at,
      subtitle: formatKm(r.distance_meters != null ? Number(r.distance_meters) : null),
      exercises: [],
    }))

    const padel: RecentSession[] = (padelResult.data ?? []).map((p) => ({
      session_type: 'padel' as const,
      session_id: p.id,
      title: 'Padel',
      started_at: p.started_at,
      subtitle: formatMinutes(p.duration_seconds),
      exercises: [],
    }))

    const handledKeys = new Set(
      (handledResult.data ?? []).map((h) =>
        feedbackKey(h.session_type as SessionFeedbackType, h.session_id),
      ),
    )

    const pending = computePendingSessions([...gym, ...runs, ...padel], handledKeys)

    return NextResponse.json({ pending } satisfies PendingFeedbackResponse)
  } catch (error) {
    console.error('GET /api/sessions/pending-feedback error:', error)
    return NextResponse.json(
      { error: 'Kan openstaande feedback niet laden', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
