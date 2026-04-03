import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface TodayHealthData {
  date: string
  steps: number | null
  active_calories: number | null
  total_calories: number | null
  active_minutes: number | null
  resting_heart_rate: number | null
  hrv_average: number | null
  stand_hours: number | null
  sleep_minutes: number | null
  weight_kg: number | null
  weight_date: string | null
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const admin = createAdminClient()
    const todayStr = new Date().toISOString().slice(0, 10)

    // Fetch today's data; if daily_activity is empty, fall back to most recent entry
    const [activityResult, sleepResult, weightResult] = await Promise.all([
      admin
        .from('daily_activity')
        .select('date, steps, active_calories, total_calories, active_minutes, stand_hours, resting_heart_rate, hrv_average')
        .eq('user_id', user.id)
        .lte('date', todayStr)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('sleep_logs')
        .select('total_sleep_minutes, date')
        .eq('user_id', user.id)
        .lte('date', todayStr)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('body_weight_logs')
        .select('weight_kg, date')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const a = activityResult.data
    const s = sleepResult.data
    const w = weightResult.data

    const response: TodayHealthData = {
      date: a?.date ?? todayStr,
      steps: a?.steps ?? null,
      active_calories: a?.active_calories != null ? Number(a.active_calories) : null,
      total_calories: a?.total_calories != null ? Number(a.total_calories) : null,
      active_minutes: a?.active_minutes ?? null,
      resting_heart_rate: a?.resting_heart_rate ?? null,
      hrv_average: a?.hrv_average != null ? Number(a.hrv_average) : null,
      stand_hours: a?.stand_hours ?? null,
      sleep_minutes: s?.total_sleep_minutes ?? null,
      weight_kg: w?.weight_kg != null ? Number(w.weight_kg) : null,
      weight_date: w?.date ?? null,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('GET /api/health/today error:', error)
    return NextResponse.json({ error: 'Failed to load health data', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
