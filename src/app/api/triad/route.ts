import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'
import {
  startOfWeekUtcIso,
  todayAmsterdam as todayAmsterdamHelper,
  weekStartAmsterdam,
} from '@/lib/time/amsterdam'

// ── Types ────────────────────────────────────────────────────────────────────

export interface TriadRing {
  /** 0-100, drives ring fill. */
  value: number
  /** Big text inside the ring (e.g. "3/5"). */
  label: string
  /** Small text below the ring (e.g. "deze week"). */
  sub: string
}

export interface TriadData {
  train: TriadRing
  recover: TriadRing
  fuel: TriadRing
}

interface WeeklyTarget {
  gym?: number
  run?: number
  padel?: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function startOfWeekAmsterdam(): string {
  return weekStartAmsterdam()
}

function todayAmsterdam(): string {
  return todayAmsterdamHelper()
}

function parseWeeklyTarget(raw: Json | null): WeeklyTarget {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const obj = raw as Record<string, unknown>
  const out: WeeklyTarget = {}
  if (typeof obj.gym === 'number') out.gym = obj.gym
  if (typeof obj.run === 'number') out.run = obj.run
  if (typeof obj.padel === 'number') out.padel = obj.padel
  return out
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n))
}

// ── ACWR → Recover score ─────────────────────────────────────────────────────
// In-band (0.8–1.3) gives 100. Outside the band, score falls linearly.
function acwrToScore(acwr: number | null): number {
  if (acwr === null) return 50
  if (acwr >= 0.8 && acwr <= 1.3) return 100
  if (acwr < 0.8) {
    // 0 = 0pt, 0.8 = 100pt
    return clamp(Math.round((acwr / 0.8) * 100))
  }
  // 1.3 = 100pt, 2.0 = 0pt
  return clamp(Math.round(((2.0 - acwr) / 0.7) * 100))
}

// ── GET handler ──────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const today = todayAmsterdam()
    const weekStart = startOfWeekAmsterdam()
    // Amsterdam-maandag 00:00 als ondubbelzinnige UTC-instant — voorkomt dat
    // late-zondag-NL-sessies (UTC nog zaterdag/zondag) deze week binnenglippen,
    // én dat maandagochtend-NL-sessies (UTC zondagavond) deze week missen.
    const weekStartUtc = startOfWeekUtcIso()

    const [workoutsThisWeek, runsThisWeek, padelThisWeek, settings, profile, weekly, nutrition] =
      await Promise.all([
        admin
          .from('workouts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('started_at', weekStartUtc),
        admin
          .from('runs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('started_at', weekStartUtc),
        admin
          .from('padel_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('started_at', weekStartUtc),
        admin
          .from('user_settings')
          .select('protein_target_per_kg, weekly_training_target')
          .eq('user_id', user.id)
          .maybeSingle(),
        admin
          .from('profiles')
          .select('weight_kg')
          .eq('id', user.id)
          .maybeSingle(),
        admin
          .from('weekly_aggregations')
          .select('acute_chronic_ratio')
          .eq('user_id', user.id)
          .order('week_start', { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin
          .from('daily_nutrition_summary')
          .select('total_calories, total_protein_g')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle(),
      ])

    // ── Train ring ─────────────────────────────────────────────────────────
    const gymCount = workoutsThisWeek.count ?? 0
    const runCount = runsThisWeek.count ?? 0
    const padelCount = padelThisWeek.count ?? 0
    const totalSessions = gymCount + runCount + padelCount

    const target = parseWeeklyTarget(settings.data?.weekly_training_target ?? null)
    const summedTarget = (target.gym ?? 0) + (target.run ?? 0) + (target.padel ?? 0)
    const hasTarget = summedTarget > 0

    const train: TriadRing = hasTarget
      ? {
          value: clamp(Math.round((totalSessions / summedTarget) * 100)),
          label: `${totalSessions}/${summedTarget}`,
          sub: 'sessies deze week',
        }
      : {
          // Geen weekdoel ingesteld — geen kunstmatige noemer (5) meer.
          value: clamp(Math.min(totalSessions * 20, 100)), // visuele indicatie, geen oordeel
          label: String(totalSessions),
          sub:
            totalSessions === 0
              ? 'sessies deze week — stel je weekdoel in'
              : `${totalSessions === 1 ? 'sessie' : 'sessies'} deze week`,
        }

    // ── Recover ring ───────────────────────────────────────────────────────
    const acwr = weekly.data?.acute_chronic_ratio ?? null
    const recoverScore = acwrToScore(acwr)
    const recover: TriadRing = {
      value: recoverScore,
      label: acwr !== null ? acwr.toFixed(2) : '—',
      sub: acwr === null ? 'geen ACWR' : recoverScore >= 80 ? 'in balans' : recoverScore >= 50 ? 'opletten' : 'overbelast',
    }

    // ── Fuel ring ──────────────────────────────────────────────────────────
    const proteinPerKg = settings.data?.protein_target_per_kg ?? null
    const weightKg = profile.data?.weight_kg ?? null
    const proteinTarget = proteinPerKg && weightKg ? Math.round(proteinPerKg * weightKg) : null
    const proteinToday = nutrition.data?.total_protein_g ?? 0

    const fuelValue =
      proteinTarget != null && proteinTarget > 0
        ? clamp(Math.round((proteinToday / proteinTarget) * 100))
        : 0

    const fuel: TriadRing = {
      value: fuelValue,
      label: proteinTarget != null ? `${Math.round(proteinToday)}/${proteinTarget}` : `${Math.round(proteinToday)}g`,
      sub: 'eiwit vandaag',
    }

    const data: TriadData = { train, recover, fuel }
    return NextResponse.json(data)
  } catch (err) {
    console.error('[triad] Error:', err)
    return NextResponse.json(
      { error: 'Failed to load triad data', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
