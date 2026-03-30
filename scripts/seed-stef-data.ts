/**
 * Seed script: Stef's baseline personal data
 * Draai met: pnpm run seed:stef
 *
 * Seeds personal records, training schema, schema block summary,
 * injury logs, and goals for the first (and only) user.
 *
 * Idempotent — uses upsert or existence checks before inserting.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  { auth: { autoRefreshToken: false, persistSession: false } },
)

// ── Types ───────────────────────────────────────────────────────────────────

type PersonalRecordInsert = Database['public']['Tables']['personal_records']['Insert']
type TrainingSchemaInsert = Database['public']['Tables']['training_schemas']['Insert']
type SchemaBlockSummaryInsert = Database['public']['Tables']['schema_block_summaries']['Insert']
type InjuryLogInsert = Database['public']['Tables']['injury_logs']['Insert']
type GoalInsert = Database['public']['Tables']['goals']['Insert']

// ── Helpers ─────────────────────────────────────────────────────────────────

async function getUserId(): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .limit(1)
    .single()

  if (error || !data) {
    throw new Error('Geen gebruiker gevonden in profiles — maak eerst een account aan')
  }

  return data.id
}

async function getExerciseIdByName(name: string): Promise<string | null> {
  const { data } = await supabase
    .from('exercise_definitions')
    .select('id')
    .eq('name', name)
    .limit(1)
    .single()

  return data?.id ?? null
}

// ── Personal Records ────────────────────────────────────────────────────────

interface PRDefinition {
  readonly exerciseName: string
  readonly recordType: string
  readonly recordCategory: string
  readonly unit: string
  readonly value: number
  readonly achievedAt: string
  readonly previousRecord: number | null
}

const BASELINE_PRS: readonly PRDefinition[] = [
  { exerciseName: 'Push-ups', recordType: 'reps', recordCategory: 'strength', unit: 'reps', value: 8, achievedAt: '2026-02-23', previousRecord: null },
  { exerciseName: 'Plank', recordType: 'duration', recordCategory: 'endurance', unit: 'seconds', value: 60, achievedAt: '2026-02-23', previousRecord: null },
  { exerciseName: 'Pull Up', recordType: 'reps', recordCategory: 'strength', unit: 'reps', value: 0, achievedAt: '2026-02-23', previousRecord: null },
  { exerciseName: 'Dumbbell Bench Press', recordType: 'weight', recordCategory: 'strength', unit: 'kg', value: 10, achievedAt: '2026-02-23', previousRecord: null },
  { exerciseName: 'Goblet Squat', recordType: 'weight', recordCategory: 'strength', unit: 'kg', value: 10, achievedAt: '2026-02-23', previousRecord: null },
  { exerciseName: 'Lat Pulldown (Cable)', recordType: 'weight', recordCategory: 'strength', unit: 'kg', value: 25, achievedAt: '2026-02-23', previousRecord: null },
]

const WEEK4_PRS: readonly PRDefinition[] = [
  { exerciseName: 'Push-ups', recordType: 'reps', recordCategory: 'strength', unit: 'reps', value: 20, achievedAt: '2026-03-23', previousRecord: 8 },
  { exerciseName: 'Plank', recordType: 'duration', recordCategory: 'endurance', unit: 'seconds', value: 95, achievedAt: '2026-03-23', previousRecord: 60 },
  { exerciseName: 'Dumbbell Bench Press', recordType: 'weight', recordCategory: 'strength', unit: 'kg', value: 16, achievedAt: '2026-03-23', previousRecord: 10 },
  { exerciseName: 'Goblet Squat', recordType: 'weight', recordCategory: 'strength', unit: 'kg', value: 16, achievedAt: '2026-03-23', previousRecord: 10 },
  { exerciseName: 'Lat Pulldown (Cable)', recordType: 'weight', recordCategory: 'strength', unit: 'kg', value: 40, achievedAt: '2026-03-23', previousRecord: 25 },
]

async function seedPersonalRecords(userId: string): Promise<void> {
  console.log('Seeding personal records...')
  let seeded = 0
  let skipped = 0

  const allPRs = [...BASELINE_PRS, ...WEEK4_PRS]

  for (const pr of allPRs) {
    const exerciseId = await getExerciseIdByName(pr.exerciseName)

    if (!exerciseId) {
      console.warn(`  Skipped PR: exercise "${pr.exerciseName}" not found in exercise_definitions`)
      skipped++
      continue
    }

    // Check if this exact record already exists
    const { data: existing } = await supabase
      .from('personal_records')
      .select('id')
      .eq('user_id', userId)
      .eq('exercise_definition_id', exerciseId)
      .eq('achieved_at', pr.achievedAt)
      .eq('value', pr.value)
      .limit(1)
      .single()

    if (existing) {
      skipped++
      continue
    }

    const record: PersonalRecordInsert = {
      user_id: userId,
      exercise_definition_id: exerciseId,
      record_type: pr.recordType,
      record_category: pr.recordCategory,
      unit: pr.unit,
      value: pr.value,
      achieved_at: pr.achievedAt,
      previous_record: pr.previousRecord,
    }

    const { error } = await supabase.from('personal_records').insert(record)

    if (error) {
      console.error(`  Failed to insert PR for ${pr.exerciseName}:`, error.message)
    } else {
      seeded++
    }
  }

  console.log(`  ${seeded} personal records seeded, ${skipped} skipped`)
}

// ── Training Schema ─────────────────────────────────────────────────────────

const ACTIVE_SCHEMA_TITLE = 'Week 5-8: Upper/Lower Split'

const WORKOUT_SCHEDULE = [
  {
    day: 'monday',
    focus: 'Upper A',
    exercises: [
      { name: 'Dumbbell Bench Press', sets: 4, reps: '8-10', notes: 'Schouder: pijnvrij' },
      { name: 'Cable Row', sets: 3, reps: '10-12', notes: '' },
      { name: 'Face Pull', sets: 3, reps: '15', notes: 'Schouder rehab' },
      { name: 'Chest-Supported DB Row', sets: 3, reps: '10-12', notes: 'Vervanging single arm cable row' },
      { name: 'Lateral Raise', sets: 3, reps: '12-15', notes: '' },
      { name: 'Push-ups', sets: 2, reps: 'max', notes: 'Barometer' },
    ],
  },
  {
    day: 'tuesday',
    focus: 'Lower A',
    exercises: [
      { name: 'Goblet Squat', sets: 4, reps: '8-10', notes: 'Tot parallel, niet diep (knieen)' },
      { name: 'Leg Press', sets: 3, reps: '10-12', notes: 'Beperkt bereik (knieen)' },
      { name: 'Romanian Deadlift', sets: 3, reps: '10', notes: 'Neutrale rug, initiatie vanuit heupen' },
      { name: 'Bulgarian Split Squat', sets: 3, reps: '10/been', notes: 'NIET na intervals!' },
      { name: 'Plank', sets: 2, reps: 'max hold', notes: 'Barometer' },
      { name: 'Dead Bug', sets: 2, reps: '10/kant', notes: 'Core stabiliteit' },
    ],
  },
  {
    day: 'wednesday',
    focus: 'Upper B',
    exercises: [
      { name: 'Lat Pulldown', sets: 4, reps: '8-10', notes: '' },
      { name: 'Dumbbell Bench Press', sets: 3, reps: '10-12', notes: 'Lichter dan Upper A' },
      { name: 'Cable Face Pull', sets: 3, reps: '15', notes: 'Schouder rehab' },
      { name: 'Seated Cable Row', sets: 3, reps: '10-12', notes: '' },
      { name: 'Pallof Press', sets: 2, reps: '10/kant', notes: 'Core anti-rotatie' },
      { name: 'Bicep Curl', sets: 2, reps: '12', notes: '' },
    ],
  },
  {
    day: 'thursday',
    focus: 'Lower B',
    exercises: [
      { name: 'Leg Press', sets: 4, reps: '10-12', notes: 'Beperkt bereik' },
      { name: 'Romanian Deadlift', sets: 3, reps: '10', notes: '' },
      { name: 'Hip Thrust', sets: 3, reps: '10-12', notes: '' },
      { name: 'Leg Curl', sets: 3, reps: '12', notes: '' },
      { name: 'Calf Raise', sets: 3, reps: '15', notes: '' },
      { name: 'Dead Bug', sets: 2, reps: '10/kant', notes: '' },
    ],
  },
]

async function seedTrainingSchema(userId: string): Promise<string> {
  console.log('Seeding training schema...')

  // Check if schema already exists
  const { data: existing } = await supabase
    .from('training_schemas')
    .select('id')
    .eq('user_id', userId)
    .eq('title', ACTIVE_SCHEMA_TITLE)
    .limit(1)
    .single()

  if (existing) {
    console.log('  Training schema already exists, skipped')
    return existing.id
  }

  // Deactivate any currently active schemas first
  await supabase
    .from('training_schemas')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('is_active', true)

  const schema: TrainingSchemaInsert = {
    user_id: userId,
    title: ACTIVE_SCHEMA_TITLE,
    schema_type: 'upper_lower',
    weeks_planned: 4,
    start_date: '2026-03-24',
    is_active: true,
    ai_generated: false,
    workout_schedule: WORKOUT_SCHEDULE,
  }

  const { data, error } = await supabase
    .from('training_schemas')
    .insert(schema)
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`Failed to insert training schema: ${error?.message}`)
  }

  console.log('  Training schema seeded')
  return data.id
}

// ── Previous Schema (for block summary) ─────────────────────────────────────

const PREVIOUS_SCHEMA_TITLE = 'Week 1-4: Beginner Full Body'

async function seedPreviousSchemaAndSummary(userId: string): Promise<void> {
  console.log('Seeding previous schema and block summary...')

  // Check if previous schema already exists
  let schemaId: string

  const { data: existing } = await supabase
    .from('training_schemas')
    .select('id')
    .eq('user_id', userId)
    .eq('title', PREVIOUS_SCHEMA_TITLE)
    .limit(1)
    .single()

  if (existing) {
    schemaId = existing.id
    console.log('  Previous schema already exists')
  } else {
    const previousSchema: TrainingSchemaInsert = {
      user_id: userId,
      title: PREVIOUS_SCHEMA_TITLE,
      schema_type: 'full_body',
      weeks_planned: 4,
      start_date: '2026-02-24',
      end_date: '2026-03-23',
      is_active: false,
      ai_generated: false,
      workout_schedule: [],
    }

    const { data, error } = await supabase
      .from('training_schemas')
      .insert(previousSchema)
      .select('id')
      .single()

    if (error || !data) {
      throw new Error(`Failed to insert previous schema: ${error?.message}`)
    }

    schemaId = data.id
    console.log('  Previous schema seeded')
  }

  // Check if block summary already exists
  const { data: existingSummary } = await supabase
    .from('schema_block_summaries')
    .select('id')
    .eq('schema_id', schemaId)
    .limit(1)
    .single()

  if (existingSummary) {
    console.log('  Block summary already exists, skipped')
    return
  }

  const summary: SchemaBlockSummaryInsert = {
    user_id: userId,
    schema_id: schemaId,
    summary: 'DB Bench 10->16kg, Goblet Squat 10->16kg, Lat Pulldown 25->40kg, Push-ups 8->20, Plank 60->95s',
    adherence_percentage: 85,
    key_progressions: 'DB Bench 10->16kg, Goblet Squat 10->16kg, Lat Pulldown 25->40kg, Push-ups 8->20, Plank 60->95s',
    exercises_used: [
      'Dumbbell Bench Press',
      'Goblet Squat',
      'Lat Pulldown (Cable)',
      'Cable Row',
      'Romanian Deadlift (Barbell)',
      'Push-ups',
      'Plank',
      'Dead Bug',
      'Face Pull',
    ],
    end_reason: 'completed',
    total_sessions_planned: 16,
    total_sessions_completed: 14,
  }

  const { error } = await supabase.from('schema_block_summaries').insert(summary)

  if (error) {
    throw new Error(`Failed to insert block summary: ${error.message}`)
  }

  console.log('  Block summary seeded')
}

// ── Injury Logs ─────────────────────────────────────────────────────────────

interface InjuryDefinition {
  readonly bodyLocation: string
  readonly severity: string
  readonly description: string
  readonly status: string
  readonly date: string
}

const INJURIES: readonly InjuryDefinition[] = [
  {
    bodyLocation: 'rechter schouder',
    severity: 'severe',
    description: 'Verdenking intra-articulaire/labrumpathologie. Beperkte externe rotatie. Pijn bij trekbewegingen en forceful overhead. Single arm cable row provoceert. MRI-arthrogram referral pending. GEEN overhead pressing.',
    status: 'active',
    date: '2026-02-15',
  },
  {
    bodyLocation: 'beide knieen',
    severity: 'moderate',
    description: 'OCD beide knieen, kraakbeentransplantatie 2016. Squats tot parallel, niet diep. BSS niet na intervaltraining. Leg press beperkt bereik.',
    status: 'active',
    date: '2026-02-15',
  },
  {
    bodyLocation: 'onderrug',
    severity: 'mild',
    description: 'Gerelateerd aan langdurig zitten en heupflexor-stijfheid. Dead bugs, Pallof press, planks in schema houden. RDLs met neutrale rug.',
    status: 'active',
    date: '2026-02-15',
  },
]

async function seedInjuryLogs(userId: string): Promise<void> {
  console.log('Seeding injury logs...')
  let seeded = 0
  let skipped = 0

  for (const injury of INJURIES) {
    // Check if injury for this body location already exists
    const { data: existing } = await supabase
      .from('injury_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('body_location', injury.bodyLocation)
      .eq('date', injury.date)
      .limit(1)
      .single()

    if (existing) {
      skipped++
      continue
    }

    const record: InjuryLogInsert = {
      user_id: userId,
      body_location: injury.bodyLocation,
      severity: injury.severity,
      description: injury.description,
      status: injury.status,
      date: injury.date,
    }

    const { error } = await supabase.from('injury_logs').insert(record)

    if (error) {
      console.error(`  Failed to insert injury for ${injury.bodyLocation}:`, error.message)
    } else {
      seeded++
    }
  }

  console.log(`  ${seeded} injury logs seeded, ${skipped} skipped`)
}

// ── Goals ───────────────────────────────────────────────────────────────────

interface GoalDefinition {
  readonly title: string
  readonly category: string
  readonly targetType: string
  readonly targetValue: number
  readonly targetUnit: string
  readonly currentValue: number
  readonly deadline: string | null
  readonly description: string
}

const GOALS: readonly GoalDefinition[] = [
  {
    title: 'Pull-up',
    category: 'strength',
    targetType: 'numeric',
    targetValue: 1,
    targetUnit: 'reps',
    currentValue: 0,
    deadline: '2026-06-30',
    description: 'Eerste pull-up kunnen uitvoeren',
  },
  {
    title: 'DB Bench 20kg',
    category: 'strength',
    targetType: 'numeric',
    targetValue: 20,
    targetUnit: 'kg',
    currentValue: 16,
    deadline: null,
    description: 'Dumbbell Bench Press naar 20kg per hand',
  },
  {
    title: 'Plank 2:00',
    category: 'strength',
    targetType: 'numeric',
    targetValue: 120,
    targetUnit: 'seconds',
    currentValue: 95,
    deadline: null,
    description: 'Plank vasthouden voor 2 minuten',
  },
  {
    title: '10K race',
    category: 'running',
    targetType: 'boolean',
    targetValue: 1,
    targetUnit: 'completion',
    currentValue: 0,
    deadline: '2026-04-11',
    description: '10K race finishen',
  },
  {
    title: '140g eiwit/dag',
    category: 'nutrition',
    targetType: 'habit',
    targetValue: 140,
    targetUnit: 'grams',
    currentValue: 0,
    deadline: null,
    description: 'Dagelijks 140g eiwit binnenkrijgen',
  },
]

async function seedGoals(userId: string): Promise<void> {
  console.log('Seeding goals...')
  let seeded = 0
  let skipped = 0

  for (const goal of GOALS) {
    // Check if goal with this title already exists
    const { data: existing } = await supabase
      .from('goals')
      .select('id')
      .eq('user_id', userId)
      .eq('title', goal.title)
      .limit(1)
      .single()

    if (existing) {
      skipped++
      continue
    }

    const record: GoalInsert = {
      user_id: userId,
      title: goal.title,
      category: goal.category,
      target_type: goal.targetType,
      target_value: goal.targetValue,
      target_unit: goal.targetUnit,
      current_value: goal.currentValue,
      deadline: goal.deadline,
      description: goal.description,
      status: 'active',
    }

    const { error } = await supabase.from('goals').insert(record)

    if (error) {
      console.error(`  Failed to insert goal "${goal.title}":`, error.message)
    } else {
      seeded++
    }
  }

  console.log(`  ${seeded} goals seeded, ${skipped} skipped`)
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Pulse: Seeding Stef baseline data\n')

  try {
    const userId = await getUserId()
    console.log(`User ID: ${userId}\n`)

    await seedPersonalRecords(userId)
    await seedTrainingSchema(userId)
    await seedPreviousSchemaAndSummary(userId)
    await seedInjuryLogs(userId)
    await seedGoals(userId)

    console.log('\nSeed compleet!')
  } catch (err) {
    console.error('\nSeed mislukt:', err)
    process.exit(1)
  }
}

main()
