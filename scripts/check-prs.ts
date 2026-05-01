import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
for (const line of readFileSync('/Users/stef/Code/pulse/pulse/.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
async function main() {
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: ex } = await c
    .from('exercise_definitions')
    .select('id, name')
    .ilike('name', '%bench press%dumbbell%')
    .limit(3)
  console.log('Exercises:', ex)
  if (ex?.[0]) {
    const { data: sets } = await c
      .from('workout_sets')
      .select('weight_kg, reps, set_type, workout_exercises!inner(exercise_definition_id)')
      .eq('workout_exercises.exercise_definition_id', ex[0].id)
      .order('weight_kg', { ascending: false })
      .limit(10)
    console.log('Top 10 sets for', ex[0].name)
    for (const s of sets ?? []) console.log(`  ${s.weight_kg}kg x ${s.reps} (${s.set_type})`)
  }
}
main()
