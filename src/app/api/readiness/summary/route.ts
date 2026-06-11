import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MEMORY_MODEL } from '@/lib/ai/client'
import { READINESS_SUMMARY_SYSTEM, buildReadinessUserMessage } from '@/lib/ai/prompts/readiness-summary'
import type { ReadinessLevel } from '@/types/readiness'
import { computeReadiness } from '@/lib/aggregations/readiness'

export const maxDuration = 20

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReadinessSummary {
  sentence: string
  score: number
  level: ReadinessLevel
  breakdown: {
    sleep: number | null
    hrv: number | null
    rhr: number | null
  }
  acwr: number | null
  todayWorkout: string | null
  cachedAt: string
  /**
   * Cold-start status. Pulse needs ~14 days of HRV samples to compute
   * trustworthy baselines. While `coldStart` is true the UI shows a
   * "still learning, X nights to go" hint and softens the score visual.
   */
  coldStart: {
    active: boolean
    hrvDays: number
    nightsRemaining: number
  }
}

// ── In-memory cache ──────────────────────────────────────────────────────────

interface CacheEntry {
  value: ReadinessSummary
  expiresAt: number
}

const CACHE_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours
const cache = new Map<string, CacheEntry>()

function cacheKey(userId: string): string {
  // Auto-invalidate at midnight Amsterdam time by including the date in the key.
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
  return `${userId}:${today}`
}

function toAmsterdamDate(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
}

// Convert raw metric values to a 0-100 indicator. Without baselines (UXR-101)
// these are rough thresholds; the UI uses them as relative bars, not science.
function metricBreakdown(
  sleepMinutes: number | null,
  hrv: number | null,
  restingHR: number | null,
): { sleep: number | null; hrv: number | null; rhr: number | null } {
  const sleep =
    sleepMinutes !== null
      ? Math.max(0, Math.min(100, Math.round((sleepMinutes / 480) * 100)))
      : null
  // HRV: 30ms ≈ low, 70ms ≈ excellent
  const hrvScore =
    hrv !== null
      ? Math.max(0, Math.min(100, Math.round(((hrv - 30) / 40) * 100)))
      : null
  // RHR: lower is better. 45 ≈ excellent, 70 ≈ poor.
  const rhrScore =
    restingHR !== null
      ? Math.max(0, Math.min(100, Math.round(((70 - restingHR) / 25) * 100)))
      : null
  return { sleep, hrv: hrvScore, rhr: rhrScore }
}

// ── Fallback sentence (no Claude call) ────────────────────────────────────────

function fallbackSentence(level: ReadinessLevel, todayWorkout: string | null): string {
  if (level === 'rest_day') return 'Geen workout gepland — geniet van je herstel of plan een easy run.'
  if (level === 'fatigued') {
    return todayWorkout
      ? `Lichaam is vermoeid — overweeg een lichte ${todayWorkout} of een rustdag.`
      : 'Lichaam is vermoeid — luister naar jezelf, vandaag rustig.'
  }
  if (level === 'good' && todayWorkout) {
    return `Goed hersteld, ${todayWorkout} staat klaar — ga ervoor.`
  }
  return todayWorkout ? `${todayWorkout} vandaag — train op gevoel.` : 'Train op gevoel vandaag.'
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

  // Cache hit → return immediately
  const key = cacheKey(user.id)
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) {
    return NextResponse.json(hit.value)
  }

  try {
    const admin = createAdminClient()
    const now = new Date()

    // Cold-start window: count distinct dates with any biometric (HRV or RHR)
    // in the last 21 days. HRV is preferred but many users only stream RHR.
    const twentyOneDaysAgo = new Date(now)
    twentyOneDaysAgo.setDate(twentyOneDaysAgo.getDate() - 21)
    const twentyOneDaysAgoStr = toAmsterdamDate(twentyOneDaysAgo)

    // Readiness v2 (audit #15): one source of truth for the score — z-scores
    // vs own 30d baselines, ACWR from the canonical persisted EWMA chain,
    // daily check-in included.
    const [readiness, biometricHistory] = await Promise.all([
      computeReadiness(user.id),
      admin
        .from('daily_activity')
        .select('date, hrv_average, resting_heart_rate')
        .eq('user_id', user.id)
        .gte('date', twentyOneDaysAgoStr),
    ])

    const biometricRows = biometricHistory.data ?? []
    const hrvDays = biometricRows.filter((r) => r.hrv_average !== null).length
    const biometricDays = biometricRows.filter(
      (r) => r.hrv_average !== null || r.resting_heart_rate !== null,
    ).length
    const COLD_START_THRESHOLD = 14
    const coldStart = {
      active: biometricDays < COLD_START_THRESHOLD,
      hrvDays,
      nightsRemaining: Math.max(0, COLD_START_THRESHOLD - biometricDays),
    }

    const { level, score, todayWorkout, acwr, sleepMinutes, restingHR, hrv, recentSessions } =
      readiness
    const breakdown = metricBreakdown(sleepMinutes, hrv, restingHR)

    // Generate the sentence via Haiku — fall back to a pre-canned line if it fails
    let sentence: string
    try {
      const { text } = await generateText({
        model: anthropic(MEMORY_MODEL),
        system: READINESS_SUMMARY_SYSTEM,
        messages: [
          {
            role: 'user',
            content: buildReadinessUserMessage({
              level,
              todayWorkout,
              acwr,
              sleepMinutes,
              restingHR,
              hrv,
              recentSessions,
              score,
            }),
          },
        ],
        maxOutputTokens: 80,
      })
      sentence = text.trim().replace(/^["']|["']$/g, '') || fallbackSentence(level, todayWorkout)
    } catch (err) {
      console.error('[readiness/summary] Claude call failed, using fallback:', err)
      sentence = fallbackSentence(level, todayWorkout)
    }

    const summary: ReadinessSummary = {
      sentence,
      score,
      level,
      breakdown,
      acwr,
      todayWorkout,
      cachedAt: new Date().toISOString(),
      coldStart,
    }

    cache.set(key, { value: summary, expiresAt: Date.now() + CACHE_TTL_MS })

    return NextResponse.json(summary)
  } catch (err) {
    console.error('[readiness/summary] Error:', err)
    return NextResponse.json(
      { error: 'Failed to load readiness summary', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
