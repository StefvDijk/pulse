import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MEMORY_MODEL } from '@/lib/ai/client'
import type { Json } from '@/types/database'
import {
  addDaysToKey,
  dayIndexAmsterdam,
  formatTime,
  todayAmsterdam as todayAmsterdamHelper,
  weekStartAmsterdam,
} from '@/lib/time/amsterdam'

export const maxDuration = 20

// ── Types ────────────────────────────────────────────────────────────────────

export type TodayMoveType = 'training' | 'rest' | 'check_in'

export interface TodayMove {
  type: TodayMoveType
  title: string
  subtitle: string
  actionLabel: string
  actionHref: string
  cachedAt: string
}

interface ScheduleSession {
  day: string
  focus: string
}

interface WeekBlock {
  week: number
  sessions: ScheduleSession[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayAmsterdam(): string {
  return todayAmsterdamHelper()
}

function todayDayName(): string {
  return new Date()
    .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Europe/Amsterdam' })
    .toLowerCase()
}

function nowInAmsterdam(): { dayOfWeek: number; hour: number } {
  // dayOfWeek is in JS-conventie (0=zo, 1=ma, ..., 6=za) voor backwards compat met onderstaande logica.
  const idx = dayIndexAmsterdam() // 1=ma...7=zo
  const dayOfWeek = idx === 7 ? 0 : idx
  const hour = Number(formatTime(new Date()).slice(0, 2))
  return { dayOfWeek, hour }
}

function extractSessions(schedule: Json): ScheduleSession[] {
  if (!Array.isArray(schedule)) return []
  const first = schedule[0]
  if (!first || typeof first !== 'object' || first === null) return []

  if ('sessions' in first) {
    return (schedule as unknown as WeekBlock[])
      .flatMap((b) => (Array.isArray(b.sessions) ? b.sessions : []))
      .filter(
        (s): s is ScheduleSession =>
          typeof s === 'object' && s !== null && 'day' in s && 'focus' in s,
      )
  }

  return schedule
    .filter(
      (s): s is Json & ScheduleSession =>
        typeof s === 'object' && s !== null && 'day' in s && 'focus' in s,
    )
    .map((s) => ({ day: String(s.day), focus: String(s.focus) }))
}

// ── In-memory cache ──────────────────────────────────────────────────────────

interface CacheEntry {
  value: TodayMove
  expiresAt: number
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, CacheEntry>()

function cacheKey(userId: string): string {
  return `${userId}:${todayAmsterdam()}`
}

// ── Sub-text generation ─────────────────────────────────────────────────────

const SUBTEXT_SYSTEM = `Je bent Pulse Coach. Schrijf één korte Nederlandse coachingzin
(max 12 woorden) die past bij Stef's dagritueel. Geef context + actie.

Voorbeelden:
- "Pak je gear voor het slapen — 06:30 alarm staat al."
- "Easy run van 5km past mooi tussen meetings."
- "Recovery walk in de zon — vergeet je water niet."
- "Tijd voor je weekreview — koffie erbij."

Regels:
- 1 zin, max 12 woorden
- Geen "goed bezig!" of uitroeptekens
- Direct en feitelijk
- Geef UITSLUITEND de zin, geen quotes of labels.`

function fallbackSubtitle(type: TodayMoveType, title: string): string {
  switch (type) {
    case 'training':
      return title.toLowerCase().includes('run')
        ? 'Easy run — pas op je tempo, pace komt vanzelf.'
        : `Vandaag ${title} — gear klaarleggen voor het slapen.`
    case 'rest':
      return 'Recovery walk in de zon — herstel is ook training.'
    case 'check_in':
      return 'Tijd voor je weekreview — pak je koffie erbij.'
  }
}

async function generateSubtitle(type: TodayMoveType, title: string): Promise<string> {
  try {
    const { text } = await generateText({
      model: anthropic(MEMORY_MODEL),
      system: SUBTEXT_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Type: ${type}\nTitel: ${title}\nGenereer één coachingzin.`,
        },
      ],
      maxOutputTokens: 60,
    })
    const trimmed = text.trim().replace(/^["']|["']$/g, '')
    return trimmed || fallbackSubtitle(type, title)
  } catch (err) {
    console.error('[today] Haiku call failed, using fallback:', err)
    return fallbackSubtitle(type, title)
  }
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

  const key = cacheKey(user.id)
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) {
    return NextResponse.json(hit.value)
  }

  try {
    const admin = createAdminClient()
    const { dayOfWeek, hour } = nowInAmsterdam()

    // Check-in window: Sunday after 18:00 or Monday before noon — but only if
    // there's no review already saved for the current week.
    const isCheckInWindow = (dayOfWeek === 0 && hour >= 18) || (dayOfWeek === 1 && hour < 12)

    let alreadyReviewedThisWeek = false
    if (isCheckInWindow) {
      // Maandag van de huidige (zo) of komende (ma) Amsterdam-week.
      const idx = dayIndexAmsterdam()
      const mondayStr =
        idx === 7
          ? addDaysToKey(weekStartAmsterdam(), 7) // zondag → komende maandag
          : weekStartAmsterdam() // maandag → vandaag

      const { data } = await admin
        .from('weekly_reviews')
        .select('id')
        .eq('user_id', user.id)
        .eq('week_start', mondayStr)
        .maybeSingle()
      alreadyReviewedThisWeek = !!data
    }

    let move: TodayMove

    if (isCheckInWindow && !alreadyReviewedThisWeek) {
      const subtitle = await generateSubtitle('check_in', 'Weekreview')
      move = {
        type: 'check_in',
        title: 'Tijd voor je weekreview',
        subtitle,
        actionLabel: 'Start check-in',
        actionHref: '/check-in',
        cachedAt: new Date().toISOString(),
      }
    } else {
      // Determine training vs rest from active schema
      const { data: schema } = await admin
        .from('training_schemas')
        .select('workout_schedule')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      const sessions = schema ? extractSessions(schema.workout_schedule) : []
      const todayName = todayDayName()
      const today = sessions.find((s) => s.day.toLowerCase() === todayName)

      if (today) {
        const subtitle = await generateSubtitle('training', today.focus)
        move = {
          type: 'training',
          title: today.focus,
          subtitle,
          actionLabel: 'Open schema',
          actionHref: '/schema',
          cachedAt: new Date().toISOString(),
        }
      } else {
        const subtitle = await generateSubtitle('rest', 'Rustdag')
        move = {
          type: 'rest',
          title: 'Rustdag',
          subtitle,
          actionLabel: 'Bekijk je week',
          actionHref: '/schema',
          cachedAt: new Date().toISOString(),
        }
      }
    }

    cache.set(key, { value: move, expiresAt: Date.now() + CACHE_TTL_MS })
    return NextResponse.json(move)
  } catch (err) {
    console.error('[today] Error:', err)
    return NextResponse.json(
      { error: 'Failed to load today move', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
