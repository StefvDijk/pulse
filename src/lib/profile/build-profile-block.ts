import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Profile shape (matches user_profile JSONB columns)
// ---------------------------------------------------------------------------

interface Basics {
  age?: number
  height_cm?: number
  location?: string
  work?: string
  diet?: string
  schedule_pattern?: string
}

interface RecurringHabit {
  label: string
  frequency?: string
  days?: string[]
  notes?: string
}

interface ProfileInjury {
  location: string
  status?: string
  restrictions?: string[]
  notes?: string
}

interface NutritionTargets {
  protein_g_per_day?: number | null
  kcal_training?: number | null
  kcal_rest?: number | null
  structure_notes?: string[]
  supplements?: string[]
  weak_spots?: string[]
}

interface TrainingResponseLesson {
  lesson: string
  learned_at?: string
}

interface BarometerExercise {
  exercise: string
  baseline?: string
  current?: string
  target?: string
  status?: string
}

export interface UserProfile {
  basics?: Basics | null
  recurring_habits?: RecurringHabit[] | null
  injuries?: ProfileInjury[] | null
  nutrition_targets?: NutritionTargets | null
  training_response?: TrainingResponseLesson[] | null
  gym_location?: string | null
  barometer_exercises?: BarometerExercise[] | null
  body_composition_notes?: string | null
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loadUserProfile(userId: string): Promise<UserProfile | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('user_profile')
    .select('basics, recurring_habits, injuries, nutrition_targets, training_response, gym_location, barometer_exercises, body_composition_notes')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[user_profile] load failed:', error)
    return null
  }
  return data as UserProfile | null
}

// ---------------------------------------------------------------------------
// Markdown renderer — produces the block that replaces sections 2/3/5/9/10/11
// of the system prompt.
// ---------------------------------------------------------------------------

export function renderProfileBlock(profile: UserProfile | null): string {
  if (!profile) return ''

  const lines: string[] = []

  // Section 2 — basics
  if (profile.basics) {
    const b = profile.basics
    lines.push('## STEF\'S PROFIEL')
    if (b.age && b.height_cm) lines.push(`- ${b.age} jaar, ${(b.height_cm / 100).toFixed(2)}m${b.location ? `, ${b.location}` : ''}`)
    if (b.work) lines.push(`- ${b.work}`)
    if (b.diet) lines.push(`- ${b.diet}`)
    if (profile.gym_location) lines.push(`- Traint bij ${profile.gym_location}`)
    if (b.schedule_pattern) lines.push(`- ${b.schedule_pattern}`)
    if (profile.recurring_habits?.length) {
      for (const h of profile.recurring_habits) {
        const days = h.days?.length ? ` (${h.days.join('/')})` : ''
        lines.push(`- ${h.label}${days}${h.notes ? ` — ${h.notes}` : ''}`)
      }
    }
    lines.push('')
  }

  // Section 3 — injuries (rich)
  if (profile.injuries?.length) {
    lines.push('## BLESSURES (KRITIEK — altijd meewegen)')
    for (const inj of profile.injuries) {
      lines.push(`**${inj.location}${inj.status ? ` (${inj.status})` : ''}:**`)
      if (inj.restrictions?.length) {
        for (const r of inj.restrictions) lines.push(`- ${r}`)
      }
      if (inj.notes) lines.push(`- ${inj.notes}`)
      lines.push('')
    }
  }

  // Section 5 — nutrition
  if (profile.nutrition_targets) {
    const n = profile.nutrition_targets
    lines.push('## VOEDING')
    if (n.protein_g_per_day) lines.push(`- Target: ~${n.protein_g_per_day}g eiwit/dag${n.kcal_training ? `, ~${n.kcal_training} kcal op trainingsdagen` : ''}`)
    if (n.structure_notes?.length) for (const s of n.structure_notes) lines.push(`- ${s}`)
    if (n.supplements?.length) lines.push(`- Supplementen: ${n.supplements.join(', ')}`)
    if (n.weak_spots?.length) for (const w of n.weak_spots) lines.push(`- Aandachtspunt: ${w}`)
    lines.push('')
  }

  // Section 9 — barometer
  if (profile.barometer_exercises?.length) {
    lines.push('## PROGRESSIE-BAROMETER')
    lines.push('| Oefening | Baseline | Huidig | Doel | Status |')
    lines.push('|----------|----------|--------|------|--------|')
    for (const e of profile.barometer_exercises) {
      lines.push(`| ${e.exercise} | ${e.baseline ?? '–'} | ${e.current ?? '–'} | ${e.target ?? '–'} | ${e.status ?? '–'} |`)
    }
    lines.push('')
  }

  // Section 10 — body composition
  if (profile.body_composition_notes) {
    lines.push('## LICHAAMSCOMPOSITIE')
    lines.push(profile.body_composition_notes)
    lines.push('')
  }

  // Section 11 — training response / lessons
  if (profile.training_response?.length) {
    lines.push('## GELEERDE LESSEN')
    for (const l of profile.training_response) lines.push(`- ${l.lesson}`)
    lines.push('')
  }

  return lines.join('\n').trim()
}
