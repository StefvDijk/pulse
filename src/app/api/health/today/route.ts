import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { todayAmsterdam } from '@/lib/time/amsterdam'

export interface TodayHealthMetrics {
  /** YYYY-MM-DD van de gevonden rij. */
  date: string
  steps: number | null
  active_calories: number | null
  total_calories: number | null
  active_minutes: number | null
  resting_heart_rate: number | null
  hrv_average: number | null
  stand_hours: number | null
  sleep_minutes: number | null
}

export interface TodayWeight {
  kg: number
  date: string
}

export interface TodayHealthData {
  /** Echte vandaag in Amsterdam (autoritatief). */
  today: string
  /** True als de gevonden activity/sleep niet van vandaag is. */
  isStale: boolean
  /**
   * Activity + sleep voor vandaag, of de laatst beschikbare dag als vandaag nog
   * geen data heeft. `null` als er überhaupt geen data is.
   */
  data: TodayHealthMetrics | null
  /** Laatste body-weight, mogelijk van een eerdere dag (weegt typisch wekelijks). */
  weight: TodayWeight | null
  /** ISO-instant van de laatste Apple Health-sync, of null. */
  lastSyncedAt: string | null
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const admin = createAdminClient()
    const today = todayAmsterdam()

    const [activityResult, sleepResult, weightResult, settingsResult] = await Promise.all([
      admin
        .from('daily_activity')
        .select('date, steps, active_calories, total_calories, active_minutes, stand_hours, resting_heart_rate, hrv_average')
        .eq('user_id', user.id)
        .lte('date', today)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('sleep_logs')
        .select('total_sleep_minutes, date')
        .eq('user_id', user.id)
        .lte('date', today)
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
      admin
        .from('user_settings')
        .select('last_apple_health_sync_at')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    const a = activityResult.data
    const s = sleepResult.data
    const w = weightResult.data

    // Bouw metrics: alleen samenvoegen als er minstens één data-bron is.
    const metricsDate = a?.date ?? s?.date ?? null
    const data: TodayHealthMetrics | null = metricsDate
      ? {
          date: metricsDate,
          steps: a?.steps ?? null,
          active_calories: a?.active_calories != null ? Number(a.active_calories) : null,
          total_calories: a?.total_calories != null ? Number(a.total_calories) : null,
          active_minutes: a?.active_minutes ?? null,
          resting_heart_rate: a?.resting_heart_rate ?? null,
          hrv_average: a?.hrv_average != null ? Number(a.hrv_average) : null,
          stand_hours: a?.stand_hours ?? null,
          sleep_minutes: s?.total_sleep_minutes ?? null,
        }
      : null

    const isStale = data ? data.date !== today : false

    const weight: TodayWeight | null =
      w?.weight_kg != null && w.date
        ? { kg: Number(w.weight_kg), date: w.date }
        : null

    const response: TodayHealthData = {
      today,
      isStale,
      data,
      weight,
      lastSyncedAt: settingsResult.data?.last_apple_health_sync_at ?? null,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('GET /api/health/today error:', error)
    return NextResponse.json({ error: 'Failed to load health data', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
