import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface RunDetailData {
  id: string
  started_at: string
  ended_at: string | null
  distance_meters: number
  duration_seconds: number
  avg_pace_seconds_per_km: number | null
  elevation_gain_meters: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  calories_burned: number | null
  notes: string | null
  run_type: string | null
  source: string
  strava_activity_id: number | null
  /** Encoded summary polyline from Strava when available. */
  polyline: string | null
  /** Strava activity name (often more descriptive than 'Morning Run'). */
  strava_name: string | null
}

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: run, error } = await admin
      .from('runs')
      .select(
        'id, started_at, ended_at, distance_meters, duration_seconds, avg_pace_seconds_per_km, elevation_gain_meters, avg_heart_rate, max_heart_rate, calories_burned, notes, run_type, source, strava_activity_id',
      )
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('[GET /api/runs/[id]] db error:', error)
      return NextResponse.json({ error: 'Laden mislukt' }, { status: 500 })
    }
    if (!run) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    let polyline: string | null = null
    let stravaName: string | null = null
    if (run.strava_activity_id) {
      const { data: sa } = await admin
        .from('strava_activities')
        .select('name, summary_polyline, detailed_polyline')
        .eq('user_id', user.id)
        .eq('strava_activity_id', run.strava_activity_id)
        .maybeSingle()
      polyline = sa?.detailed_polyline ?? sa?.summary_polyline ?? null
      stravaName = sa?.name ?? null
    }

    const data: RunDetailData = {
      ...run,
      polyline,
      strava_name: stravaName,
    }
    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/runs/[id]] error:', err)
    return NextResponse.json({ error: 'Onverwachte fout' }, { status: 500 })
  }
}
