import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type QuestionType =
  | 'nutrition_log'
  | 'nutrition_question'
  | 'injury_report'
  | 'schema_request'
  | 'progress_question'
  | 'weekly_review'
  | 'general_chat'

const NUTRITION_LOG_KEYWORDS = [
  'gegeten', 'geëten', 'had ik', 'ontbijt', 'lunch', 'avondeten', 'diner',
  'snack', 'gegeten heb', 'at ik', 'maaltijd', 'eten gehad', 'ik heb',
  'smoothie', 'shake', 'gedronken', 'at', 'eet', 'gegeten:',
]

const NUTRITION_QUESTION_KEYWORDS = [
  'eiwit', 'calorie', 'macro', 'voeding', 'dieet', 'protein', 'kcal',
  'koolhydraten', 'vet', 'vezels', 'vitaminen', 'voedingswaarde',
]

const INJURY_KEYWORDS = [
  'pijn', 'blessure', 'letsel', 'zeer', 'kwetsuur', 'geblesseerd',
  'pijnlijk', 'klacht', 'zeer', 'trekking', 'kramp', 'spierpijn', 'blesseerd',
]

const SCHEMA_KEYWORDS = [
  'schema', 'programma', 'trainingsplan', 'workout plan', 'trainingsprogramma',
  'nieuw schema', 'maak een', 'genereer', 'plan maken', 'trainingsschema',
]

const PROGRESS_KEYWORDS = [
  'progressie', 'sterker', 'verbetering', 'pr', 'record', 'personal record',
  'verbetering', 'bench', 'squat', 'deadlift', 'maxima', 'vooruitgang',
]

const WEEKLY_REVIEW_KEYWORDS = [
  'week', 'samenvatting', 'hoe was', 'terugkijk', 'overzicht', 'deze week',
  'vorige week', 'weekoverzicht', 'hoe heb ik', 'weekresultaten',
]

export function classifyQuestion(message: string): QuestionType {
  const lower = message.toLowerCase()

  const has = (keywords: string[]) => keywords.some((kw) => lower.includes(kw))

  // Nutrition log: high-confidence food descriptions
  if (has(NUTRITION_LOG_KEYWORDS) && !has(SCHEMA_KEYWORDS)) return 'nutrition_log'

  // Injury report
  if (has(INJURY_KEYWORDS)) return 'injury_report'

  // Schema request
  if (has(SCHEMA_KEYWORDS)) return 'schema_request'

  // Progress question
  if (has(PROGRESS_KEYWORDS)) return 'progress_question'

  // Weekly review
  if (has(WEEKLY_REVIEW_KEYWORDS)) return 'weekly_review'

  // Nutrition question (general)
  if (has(NUTRITION_QUESTION_KEYWORDS)) return 'nutrition_question'

  return 'general_chat'
}

type SupabaseClientType = SupabaseClient<Database>

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

export async function assembleContext(
  userId: string,
  type: QuestionType,
  supabase: SupabaseClientType,
): Promise<string> {
  const sections: string[] = []

  try {
    if (type === 'nutrition_log' || type === 'nutrition_question') {
      // User settings (protein target per kg)
      const { data: settings } = await supabase
        .from('user_settings')
        .select('protein_target_per_kg')
        .eq('user_id', userId)
        .maybeSingle()

      if (settings?.protein_target_per_kg) {
        sections.push(
          `## Voedingsdoelen\n- Eiwitdoel: ${settings.protein_target_per_kg}g/kg lichaamsgewicht`,
        )
      }

      // Today's summary
      const { data: todaySummary } = await supabase
        .from('daily_nutrition_summary')
        .select('total_calories, total_protein_g, total_carbs_g, total_fat_g')
        .eq('user_id', userId)
        .eq('date', today())
        .maybeSingle()

      if (todaySummary) {
        sections.push(
          `## Vandaag gegeten (${today()})\n- Calorieën: ${todaySummary.total_calories ?? 0} kcal\n- Eiwit: ${todaySummary.total_protein_g ?? 0}g\n- Koolhydraten: ${todaySummary.total_carbs_g ?? 0}g\n- Vet: ${todaySummary.total_fat_g ?? 0}g`,
        )
      }

      // Last 7 days logs (brief)
      const { data: recentLogs } = await supabase
        .from('nutrition_logs')
        .select('date, raw_input, estimated_calories, estimated_protein_g, meal_type')
        .eq('user_id', userId)
        .gte('date', daysAgo(7))
        .order('created_at', { ascending: false })
        .limit(20)

      if (recentLogs && recentLogs.length > 0) {
        const lines = recentLogs.map(
          (l) =>
            `- ${formatDate(l.date)} [${l.meal_type ?? '?'}]: ${l.raw_input.slice(0, 60)} (${l.estimated_calories ?? '?'} kcal, ${l.estimated_protein_g ?? '?'}g eiwit)`,
        )
        sections.push(`## Recente maaltijden\n${lines.join('\n')}`)
      }
    }

    if (type === 'injury_report') {
      const { data: injuries } = await supabase
        .from('injury_logs')
        .select('date, body_location, severity, description, status')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(5)

      if (injuries && injuries.length > 0) {
        const lines = injuries.map(
          (i) =>
            `- ${formatDate(i.date)} | ${i.body_location} | ${i.severity ?? 'onbekend'} | ${i.status ?? 'actief'}: ${i.description.slice(0, 80)}`,
        )
        sections.push(`## Eerdere blessures\n${lines.join('\n')}`)
      }

      // Recent workouts in case they're related
      const { data: recentWorkouts } = await supabase
        .from('workouts')
        .select('started_at, title, duration_seconds')
        .eq('user_id', userId)
        .gte('started_at', daysAgo(7))
        .order('started_at', { ascending: false })
        .limit(5)

      if (recentWorkouts && recentWorkouts.length > 0) {
        const lines = recentWorkouts.map(
          (w) => `- ${formatDate(w.started_at)}: ${w.title} (${w.duration_seconds ? Math.round(w.duration_seconds / 60) : '?'} min)`,
        )
        sections.push(`## Recente trainingen\n${lines.join('\n')}`)
      }
    }

    if (type === 'schema_request') {
      const { data: currentSchema } = await supabase
        .from('training_schemas')
        .select('title, schema_type, weeks_planned, start_date, is_active')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(3)

      if (currentSchema && currentSchema.length > 0) {
        const lines = currentSchema.map(
          (s) =>
            `- ${s.title} (${s.schema_type}, ${s.weeks_planned ?? '?'} weken, start: ${s.start_date})${s.is_active ? ' ← ACTIEF' : ''}`,
        )
        sections.push(`## Trainingsschema's\n${lines.join('\n')}`)
      }

      const { data: goals } = await supabase
        .from('goals')
        .select('title, target_value, current_value, category, deadline, status')
        .eq('user_id', userId)
        .neq('status', 'completed')
        .limit(5)

      if (goals && goals.length > 0) {
        const lines = goals.map(
          (g) =>
            `- [${g.category}] ${g.title}: ${g.current_value ?? '?'} → ${g.target_value ?? '?'}${g.deadline ? ` (deadline: ${formatDate(g.deadline)})` : ''}`,
        )
        sections.push(`## Actieve doelen\n${lines.join('\n')}`)
      }

      const { data: weeklyStats } = await supabase
        .from('weekly_aggregations')
        .select('week_start, total_sessions, gym_sessions, running_sessions, acute_chronic_ratio, workload_status')
        .eq('user_id', userId)
        .order('week_start', { ascending: false })
        .limit(4)

      if (weeklyStats && weeklyStats.length > 0) {
        const lines = weeklyStats.map(
          (w) =>
            `- Week ${formatDate(w.week_start)}: ${w.total_sessions ?? 0} sessies (gym: ${w.gym_sessions ?? 0}, run: ${w.running_sessions ?? 0}), ACWR: ${w.acute_chronic_ratio?.toFixed(2) ?? '?'} (${w.workload_status ?? '?'})`,
        )
        sections.push(`## Recente trainingsbelasting\n${lines.join('\n')}`)
      }
    }

    if (type === 'progress_question') {
      const { data: weeklyStats } = await supabase
        .from('weekly_aggregations')
        .select('week_start, total_tonnage_kg, total_running_km, total_sessions, acute_chronic_ratio')
        .eq('user_id', userId)
        .order('week_start', { ascending: false })
        .limit(8)

      if (weeklyStats && weeklyStats.length > 0) {
        const lines = weeklyStats.map(
          (w) =>
            `- ${formatDate(w.week_start)}: tonnage ${Math.round(w.total_tonnage_kg ?? 0)}kg, hardlopen ${(w.total_running_km ?? 0).toFixed(1)}km, sessies ${w.total_sessions ?? 0}`,
        )
        sections.push(`## Wekelijkse progressie (8 weken)\n${lines.join('\n')}`)
      }

      const { data: prs } = await supabase
        .from('personal_records')
        .select('record_type, value, achieved_at, exercise_definition_id, unit')
        .eq('user_id', userId)
        .order('achieved_at', { ascending: false })
        .limit(10)

      if (prs && prs.length > 0) {
        const lines = prs.map(
          (pr) => `- ${formatDate(pr.achieved_at)} [${pr.record_type}]: ${pr.value} ${pr.unit}`,
        )
        sections.push(`## Recente PRs\n${lines.join('\n')}`)
      }
    }

    if (type === 'weekly_review') {
      const { data: weekly } = await supabase
        .from('weekly_aggregations')
        .select('*')
        .eq('user_id', userId)
        .order('week_start', { ascending: false })
        .limit(2)

      if (weekly && weekly.length > 0) {
        const w = weekly[0]
        sections.push(
          `## Week ${formatDate(w.week_start)}\n- Sessies: ${w.total_sessions ?? 0} (gym: ${w.gym_sessions ?? 0}, run: ${w.running_sessions ?? 0}, padel: ${w.padel_sessions ?? 0})\n- Tonnage: ${Math.round(w.total_tonnage_kg ?? 0)}kg\n- Hardlopen: ${(w.total_running_km ?? 0).toFixed(1)}km\n- Trainingstijd: ${Math.round((w.total_training_minutes ?? 0) / 60 * 10) / 10}u\n- ACWR: ${w.acute_chronic_ratio?.toFixed(2) ?? '?'} (${w.workload_status ?? '?'})\n- Gem. calorieën: ${Math.round(w.avg_daily_calories ?? 0)} kcal/dag\n- Gem. eiwit: ${Math.round(w.avg_daily_protein_g ?? 0)}g/dag`,
        )
      }

      const { data: dailys } = await supabase
        .from('daily_aggregations')
        .select('date, is_rest_day, gym_minutes, running_minutes, padel_minutes, training_load_score')
        .eq('user_id', userId)
        .gte('date', daysAgo(7))
        .order('date', { ascending: true })

      if (dailys && dailys.length > 0) {
        const lines = dailys.map((d) => {
          const sport = d.gym_minutes
            ? 'gym'
            : d.running_minutes
              ? 'run'
              : d.padel_minutes
                ? 'padel'
                : 'rust'
          return `- ${formatDate(d.date)}: ${d.is_rest_day ? 'rustdag' : sport} (load: ${Math.round(d.training_load_score ?? 0)})`
        })
        sections.push(`## Dagelijks overzicht\n${lines.join('\n')}`)
      }
    }

    if (type === 'general_chat') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, dietary_preference')
        .eq('id', userId)
        .maybeSingle()

      const { data: settings } = await supabase
        .from('user_settings')
        .select('protein_target_per_kg')
        .eq('user_id', userId)
        .maybeSingle()

      const { data: latestWeek } = await supabase
        .from('weekly_aggregations')
        .select('week_start, total_sessions, acute_chronic_ratio, workload_status')
        .eq('user_id', userId)
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle()

      const profileLine = profile?.display_name ? `Naam: ${profile.display_name}` : ''
      const dietLine = profile?.dietary_preference ? `Voedingsvoorkeur: ${profile.dietary_preference}` : ''
      const settingsLine = settings?.protein_target_per_kg
        ? `Eiwitdoel: ${settings.protein_target_per_kg}g/kg`
        : ''
      const weekLine = latestWeek
        ? `Laatste week: ${latestWeek.total_sessions ?? 0} sessies, ACWR ${latestWeek.acute_chronic_ratio?.toFixed(2) ?? '?'} (${latestWeek.workload_status ?? '?'})`
        : ''

      const info = [profileLine, dietLine, settingsLine, weekLine].filter(Boolean).join('\n')
      if (info) sections.push(`## Gebruikersprofiel\n${info}`)
    }
  } catch (err) {
    console.error('Context assembly error:', err)
  }

  if (sections.length === 0) return ''

  return `\n\n---\n## DATA-CONTEXT\n\n${sections.join('\n\n')}\n---`
}
