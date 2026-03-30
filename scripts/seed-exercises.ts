/**
 * Seed script: exercise_definitions
 * Draai met: pnpm run seed:exercises
 *
 * Idempotent — kan meerdere keren draaien via upsert op name.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  { auth: { autoRefreshToken: false, persistSession: false } },
)

type ExerciseInsert = Database['public']['Tables']['exercise_definitions']['Insert']

const EXERCISES: ExerciseInsert[] = [
  // ── HORIZONTAL PUSH ────────────────────────────────────────────────────────
  { name: 'Bench Press (Barbell)', primary_muscle_group: 'chest', secondary_muscle_groups: ['triceps', 'shoulders'], movement_pattern: 'horizontal_push', is_compound: true, equipment: 'barbell' },
  { name: 'Incline Bench Press (Barbell)', primary_muscle_group: 'chest', secondary_muscle_groups: ['triceps', 'shoulders'], movement_pattern: 'horizontal_push', is_compound: true, equipment: 'barbell' },
  { name: 'Dumbbell Bench Press', primary_muscle_group: 'chest', secondary_muscle_groups: ['triceps', 'shoulders'], movement_pattern: 'horizontal_push', is_compound: true, equipment: 'dumbbell' },
  { name: 'Incline Dumbbell Press', primary_muscle_group: 'chest', secondary_muscle_groups: ['triceps', 'shoulders'], movement_pattern: 'horizontal_push', is_compound: true, equipment: 'dumbbell' },
  { name: 'Cable Fly', primary_muscle_group: 'chest', secondary_muscle_groups: [], movement_pattern: 'isolation', is_compound: false, equipment: 'cable' },
  { name: 'Dips', primary_muscle_group: 'chest', secondary_muscle_groups: ['triceps', 'shoulders'], movement_pattern: 'vertical_push', is_compound: true, equipment: 'bodyweight' },

  // ── VERTICAL PUSH ──────────────────────────────────────────────────────────
  { name: 'Overhead Press (Barbell)', primary_muscle_group: 'shoulders', secondary_muscle_groups: ['triceps', 'core'], movement_pattern: 'vertical_push', is_compound: true, equipment: 'barbell' },
  { name: 'Dumbbell Shoulder Press', primary_muscle_group: 'shoulders', secondary_muscle_groups: ['triceps'], movement_pattern: 'vertical_push', is_compound: true, equipment: 'dumbbell' },
  { name: 'Lateral Raise (Dumbbell)', primary_muscle_group: 'shoulders', secondary_muscle_groups: [], movement_pattern: 'isolation', is_compound: false, equipment: 'dumbbell' },
  { name: 'Front Raise (Dumbbell)', primary_muscle_group: 'shoulders', secondary_muscle_groups: [], movement_pattern: 'isolation', is_compound: false, equipment: 'dumbbell' },
  { name: 'Tricep Pushdown', primary_muscle_group: 'triceps', secondary_muscle_groups: [], movement_pattern: 'isolation', is_compound: false, equipment: 'cable' },
  { name: 'Skull Crusher (Barbell)', primary_muscle_group: 'triceps', secondary_muscle_groups: [], movement_pattern: 'isolation', is_compound: false, equipment: 'barbell' },
  { name: 'Overhead Tricep Extension', primary_muscle_group: 'triceps', secondary_muscle_groups: [], movement_pattern: 'isolation', is_compound: false, equipment: 'dumbbell' },

  // ── HORIZONTAL PULL ────────────────────────────────────────────────────────
  { name: 'Barbell Row', primary_muscle_group: 'upper_back', secondary_muscle_groups: ['biceps', 'lats'], movement_pattern: 'horizontal_pull', is_compound: true, equipment: 'barbell' },
  { name: 'Dumbbell Row', primary_muscle_group: 'upper_back', secondary_muscle_groups: ['biceps', 'lats'], movement_pattern: 'horizontal_pull', is_compound: true, equipment: 'dumbbell' },
  { name: 'Cable Row', primary_muscle_group: 'upper_back', secondary_muscle_groups: ['biceps', 'lats'], movement_pattern: 'horizontal_pull', is_compound: true, equipment: 'cable' },
  { name: 'Face Pull', primary_muscle_group: 'rotator_cuff', secondary_muscle_groups: ['shoulders', 'upper_back'], movement_pattern: 'horizontal_pull', is_compound: false, equipment: 'cable' },
  { name: 'Chest Supported Row', primary_muscle_group: 'upper_back', secondary_muscle_groups: ['biceps'], movement_pattern: 'horizontal_pull', is_compound: true, equipment: 'dumbbell' },

  // ── VERTICAL PULL ──────────────────────────────────────────────────────────
  { name: 'Pull Up', primary_muscle_group: 'lats', secondary_muscle_groups: ['biceps', 'upper_back'], movement_pattern: 'vertical_pull', is_compound: true, equipment: 'bodyweight' },
  { name: 'Chin Up', primary_muscle_group: 'lats', secondary_muscle_groups: ['biceps'], movement_pattern: 'vertical_pull', is_compound: true, equipment: 'bodyweight' },
  { name: 'Lat Pulldown (Cable)', primary_muscle_group: 'lats', secondary_muscle_groups: ['biceps', 'upper_back'], movement_pattern: 'vertical_pull', is_compound: true, equipment: 'cable' },
  { name: 'Bicep Curl (Dumbbell)', primary_muscle_group: 'biceps', secondary_muscle_groups: ['forearms'], movement_pattern: 'isolation', is_compound: false, equipment: 'dumbbell' },
  { name: 'Barbell Curl', primary_muscle_group: 'biceps', secondary_muscle_groups: ['forearms'], movement_pattern: 'isolation', is_compound: false, equipment: 'barbell' },
  { name: 'Hammer Curl (Dumbbell)', primary_muscle_group: 'biceps', secondary_muscle_groups: ['forearms'], movement_pattern: 'isolation', is_compound: false, equipment: 'dumbbell' },

  // ── SQUAT ──────────────────────────────────────────────────────────────────
  { name: 'Squat (Barbell)', primary_muscle_group: 'quads', secondary_muscle_groups: ['glutes', 'hamstrings', 'core'], movement_pattern: 'squat', is_compound: true, equipment: 'barbell' },
  { name: 'Front Squat (Barbell)', primary_muscle_group: 'quads', secondary_muscle_groups: ['glutes', 'core'], movement_pattern: 'squat', is_compound: true, equipment: 'barbell' },
  { name: 'Leg Press', primary_muscle_group: 'quads', secondary_muscle_groups: ['glutes', 'hamstrings'], movement_pattern: 'squat', is_compound: true, equipment: 'machine' },
  { name: 'Goblet Squat', primary_muscle_group: 'quads', secondary_muscle_groups: ['glutes', 'core'], movement_pattern: 'squat', is_compound: true, equipment: 'dumbbell' },
  { name: 'Leg Extension (Machine)', primary_muscle_group: 'quads', secondary_muscle_groups: [], movement_pattern: 'isolation', is_compound: false, equipment: 'machine' },

  // ── HINGE ──────────────────────────────────────────────────────────────────
  { name: 'Deadlift (Barbell)', primary_muscle_group: 'hamstrings', secondary_muscle_groups: ['glutes', 'upper_back', 'core'], movement_pattern: 'hinge', is_compound: true, equipment: 'barbell' },
  { name: 'Romanian Deadlift (Barbell)', primary_muscle_group: 'hamstrings', secondary_muscle_groups: ['glutes'], movement_pattern: 'hinge', is_compound: true, equipment: 'barbell' },
  { name: 'Romanian Deadlift (Dumbbell)', primary_muscle_group: 'hamstrings', secondary_muscle_groups: ['glutes'], movement_pattern: 'hinge', is_compound: true, equipment: 'dumbbell' },
  { name: 'Hip Thrust (Barbell)', primary_muscle_group: 'glutes', secondary_muscle_groups: ['hamstrings'], movement_pattern: 'hinge', is_compound: true, equipment: 'barbell' },
  { name: 'Leg Curl (Machine)', primary_muscle_group: 'hamstrings', secondary_muscle_groups: [], movement_pattern: 'isolation', is_compound: false, equipment: 'machine' },

  // ── LUNGE ──────────────────────────────────────────────────────────────────
  { name: 'Bulgarian Split Squat', primary_muscle_group: 'quads', secondary_muscle_groups: ['glutes', 'hamstrings'], movement_pattern: 'lunge', is_compound: true, equipment: 'dumbbell' },
  { name: 'Lunges (Dumbbell)', primary_muscle_group: 'quads', secondary_muscle_groups: ['glutes', 'hamstrings'], movement_pattern: 'lunge', is_compound: true, equipment: 'dumbbell' },
  { name: 'Step Up (Dumbbell)', primary_muscle_group: 'quads', secondary_muscle_groups: ['glutes'], movement_pattern: 'lunge', is_compound: true, equipment: 'dumbbell' },

  // ── CORE ───────────────────────────────────────────────────────────────────
  { name: 'Plank', primary_muscle_group: 'core', secondary_muscle_groups: [], movement_pattern: 'core', is_compound: false, equipment: 'bodyweight' },
  { name: 'Cable Crunch', primary_muscle_group: 'core', secondary_muscle_groups: [], movement_pattern: 'core', is_compound: false, equipment: 'cable' },
  { name: 'Hanging Leg Raise', primary_muscle_group: 'core', secondary_muscle_groups: ['hip_flexors'], movement_pattern: 'core', is_compound: false, equipment: 'bodyweight' },
  { name: 'Ab Wheel Rollout', primary_muscle_group: 'core', secondary_muscle_groups: ['shoulders'], movement_pattern: 'core', is_compound: false, equipment: 'bodyweight' },
  { name: 'Russian Twist', primary_muscle_group: 'core', secondary_muscle_groups: [], movement_pattern: 'core', is_compound: false, equipment: 'bodyweight' },
  { name: 'Dead Bug', primary_muscle_group: 'core', secondary_muscle_groups: [], movement_pattern: 'core', is_compound: false, equipment: 'bodyweight' },
  { name: 'Pallof Press', primary_muscle_group: 'core', secondary_muscle_groups: [], movement_pattern: 'core', is_compound: false, equipment: 'cable' },

  // ── BODYWEIGHT COMPOUND ────────────────────────────────────────────────────
  { name: 'Push-ups', primary_muscle_group: 'chest', secondary_muscle_groups: ['triceps', 'shoulders'], movement_pattern: 'horizontal_push', is_compound: true, equipment: 'bodyweight' },

  // ── CALVES ─────────────────────────────────────────────────────────────────
  { name: 'Calf Raise (Standing)', primary_muscle_group: 'calves', secondary_muscle_groups: [], movement_pattern: 'isolation', is_compound: false, equipment: 'machine' },
  { name: 'Calf Raise (Seated)', primary_muscle_group: 'calves', secondary_muscle_groups: [], movement_pattern: 'isolation', is_compound: false, equipment: 'machine' },
]

async function seedExercises() {
  console.log(`Seeding ${EXERCISES.length} exercise definitions...`)

  const { data, error } = await supabase
    .from('exercise_definitions')
    .upsert(EXERCISES, { onConflict: 'name' })
    .select('id, name')

  if (error) {
    console.error('Seed failed:', error.message)
    process.exit(1)
  }

  console.log(`✓ Seeded ${data?.length ?? 0} exercises`)
}

seedExercises()
