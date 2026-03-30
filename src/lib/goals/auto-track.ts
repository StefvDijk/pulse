import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Supabase = SupabaseClient<Database>

/**
 * Checks active goals and updates current_value based on recent data.
 * Marks goals as completed when current_value >= target_value (for 'max'/'count')
 * or current_value <= target_value (for 'min').
 */
export async function checkGoalProgress(userId: string, supabase: Supabase): Promise<void> {
  const { data: goals, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .not('target_value', 'is', null)

  if (error || !goals?.length) return

  const updates: Array<{ id: string; current_value: number; status?: string; completed_at?: string }> = []

  for (const goal of goals) {
    let currentValue: number | null = null

    if (goal.category === 'strength' && goal.target_type === 'max') {
      // Find the best PR matching this goal's unit
      const { data: prs } = await supabase
        .from('personal_records')
        .select('value')
        .eq('user_id', userId)
        .eq('record_category', 'strength')
        .eq('unit', goal.target_unit ?? 'kg')
        .order('value', { ascending: false })
        .limit(1)

      if (prs?.[0]) currentValue = prs[0].value
    }

    if (goal.category === 'running') {
      if (goal.target_type === 'count') {
        // Count running sessions in the current month
        const startOfMonth = new Date()
        startOfMonth.setUTCDate(1)
        startOfMonth.setUTCHours(0, 0, 0, 0)

        const { data: weeks } = await supabase
          .from('weekly_aggregations')
          .select('running_sessions')
          .eq('user_id', userId)
          .gte('week_start', startOfMonth.toISOString().slice(0, 10))

        if (weeks) {
          currentValue = weeks.reduce((sum, w) => sum + (w.running_sessions ?? 0), 0)
        }
      } else if (goal.target_type === 'min') {
        // Best running PR (fastest time/km)
        const { data: prs } = await supabase
          .from('personal_records')
          .select('value')
          .eq('user_id', userId)
          .eq('record_category', 'running')
          .order('value', { ascending: true })
          .limit(1)

        if (prs?.[0]) currentValue = prs[0].value
      }
    }

    if (goal.target_type === 'count' && (goal.category === 'strength' || goal.category === 'general')) {
      // Count gym sessions in the current month
      const startOfMonth = new Date()
      startOfMonth.setUTCDate(1)
      startOfMonth.setUTCHours(0, 0, 0, 0)

      const { data: weeks } = await supabase
        .from('weekly_aggregations')
        .select('gym_sessions')
        .eq('user_id', userId)
        .gte('week_start', startOfMonth.toISOString().slice(0, 10))

      if (weeks) {
        currentValue = weeks.reduce((sum, w) => sum + (w.gym_sessions ?? 0), 0)
      }
    }

    if (currentValue === null) continue

    const isComplete =
      goal.target_type === 'min'
        ? currentValue <= (goal.target_value ?? Infinity)
        : currentValue >= (goal.target_value ?? Infinity)

    updates.push({
      id: goal.id,
      current_value: currentValue,
      ...(isComplete ? { status: 'completed', completed_at: new Date().toISOString() } : {}),
    })
  }

  for (const update of updates) {
    await supabase.from('goals').update(update).eq('id', update.id).eq('user_id', userId)
  }
}
