/**
 * Recompute personal_records of type='weight' to use the actual max
 * single-set weight (not weight×reps). Required after CHECKIN-18 because
 * earlier Hevy syncs stored set-volume in `value`, which is misleading
 * ("Bench Press 210kg" = 18kg × ~12 reps × multiple sets, not a real
 * 210kg lift).
 *
 * Strategy:
 *   1. Wipe all existing record_type='weight' PRs for the user
 *   2. For each exercise_definition_id with at least one set:
 *      - Find the workout_set with the highest weight_kg (non-warmup)
 *      - Insert a single PR row with value=weight, reps=reps, achieved_at,
 *        workout_id linked
 *
 * Usage: pnpm tsx scripts/recompute-prs.ts [--dry-run]
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

for (const line of readFileSync('/Users/stef/Code/pulse/pulse/.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const dryRun = process.argv.includes('--dry-run')
const userId = process.env.PULSE_USER_ID
if (!userId) throw new Error('PULSE_USER_ID env var missing')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface SetRow {
  weight_kg: number
  reps: number | null
  workout_exercise: {
    workout: { id: string; user_id: string; started_at: string }
    exercise_definition_id: string
  }
}

async function main() {
  console.log(`Recomputing PRs for user ${userId} (dry-run: ${dryRun})`)

  // Fetch all non-warmup sets with positive weight, joined to workout + exercise
  const { data, error } = await supabase
    .from('workout_sets')
    .select(`
      weight_kg,
      reps,
      set_type,
      workout_exercise:workout_exercises!inner(
        exercise_definition_id,
        workout:workouts!inner(id, user_id, started_at)
      )
    `)
    .gt('weight_kg', 0)
    .neq('set_type', 'warmup')

  if (error) throw error

  // Filter to this user + group by exercise_definition_id keeping the max
  const bestByExercise = new Map<
    string,
    { weight: number; reps: number | null; achievedAt: string; workoutId: string }
  >()

  for (const row of (data as unknown as SetRow[]) ?? []) {
    const we = row.workout_exercise
    if (!we?.exercise_definition_id) continue
    const w = we.workout
    if (!w || w.user_id !== userId) continue

    const exId = we.exercise_definition_id
    const current = bestByExercise.get(exId)
    const isBetter =
      !current ||
      row.weight_kg > current.weight ||
      (row.weight_kg === current.weight && (row.reps ?? 0) > (current.reps ?? 0))

    if (isBetter) {
      bestByExercise.set(exId, {
        weight: row.weight_kg,
        reps: row.reps,
        achievedAt: w.started_at,
        workoutId: w.id,
      })
    }
  }

  console.log(`Found max-weight per exercise across ${bestByExercise.size} exercises`)

  if (dryRun) {
    const sorted = [...bestByExercise.entries()].sort((a, b) => b[1].weight - a[1].weight).slice(0, 15)
    console.log('Top 15 (dry-run preview):')
    for (const [exId, rec] of sorted) {
      const { data: ex } = await supabase
        .from('exercise_definitions')
        .select('name')
        .eq('id', exId)
        .maybeSingle()
      console.log(`  ${ex?.name ?? exId}: ${rec.weight}kg × ${rec.reps ?? '?'}`)
    }
    return
  }

  // Wipe existing weight PRs
  const { error: deleteError } = await supabase
    .from('personal_records')
    .delete()
    .eq('user_id', userId)
    .eq('record_type', 'weight')
  if (deleteError) throw deleteError
  console.log('Cleared existing weight PRs')

  // Insert recomputed
  const rows = [...bestByExercise.entries()].map(([exId, rec]) => ({
    user_id: userId,
    exercise_definition_id: exId,
    record_type: 'weight',
    record_category: 'strength',
    value: rec.weight,
    reps: rec.reps,
    unit: 'kg',
    achieved_at: rec.achievedAt,
    workout_id: rec.workoutId,
    previous_record: null,
  }))

  const { error: insertError } = await supabase.from('personal_records').insert(rows)
  if (insertError) throw insertError
  console.log(`Inserted ${rows.length} recomputed PRs`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
