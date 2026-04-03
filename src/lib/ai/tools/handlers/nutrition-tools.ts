import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function yesterday(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function periodToDates(period: string): { start: string; end: string } {
  const now = new Date()
  const end = today()

  switch (period) {
    case 'today':
      return { start: end, end }
    case 'yesterday':
      return { start: yesterday(), end: yesterday() }
    case 'this_week': {
      const day = now.getUTCDay()
      const diff = day === 0 ? 6 : day - 1
      const start = new Date(now)
      start.setUTCDate(now.getUTCDate() - diff)
      return { start: start.toISOString().slice(0, 10), end }
    }
    case 'last_week': {
      const day = now.getUTCDay()
      const diff = day === 0 ? 6 : day - 1
      const thisMonday = new Date(now)
      thisMonday.setUTCDate(now.getUTCDate() - diff)
      const lastMonday = new Date(thisMonday)
      lastMonday.setUTCDate(thisMonday.getUTCDate() - 7)
      const lastSunday = new Date(thisMonday)
      lastSunday.setUTCDate(thisMonday.getUTCDate() - 1)
      return { start: lastMonday.toISOString().slice(0, 10), end: lastSunday.toISOString().slice(0, 10) }
    }
    case 'this_month': {
      const start = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1)
      return { start: start.toISOString().slice(0, 10), end }
    }
    default:
      return { start: end, end }
  }
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}

// ---------------------------------------------------------------------------
// get_nutrition_log
// ---------------------------------------------------------------------------

export async function getNutritionLog(
  userId: string,
  input: { period: string; include_meals: boolean },
): Promise<string> {
  const { start, end } = periodToDates(input.period)
  const admin = createAdminClient()

  const [{ data: summaries }, { data: meals }] = await Promise.all([
    admin
      .from('daily_nutrition_summary')
      .select('date, total_calories, total_protein_g, total_carbs_g, total_fat_g, protein_target_g, calorie_target')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false }),
    input.include_meals
      ? admin
          .from('nutrition_logs')
          .select('date, raw_input, estimated_calories, estimated_protein_g, meal_type')
          .eq('user_id', userId)
          .gte('date', start)
          .lte('date', end)
          .order('date', { ascending: false })
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: null }),
  ])

  if (!summaries || summaries.length === 0) return `Geen voedingsdata beschikbaar voor ${start} t/m ${end}.`

  const lines: string[] = [`Voedingsdata ${start} t/m ${end}:\n`]

  let totalCal = 0
  let totalProtein = 0

  for (const s of summaries) {
    const cal = Math.round(Number(s.total_calories ?? 0))
    const protein = Math.round(Number(s.total_protein_g ?? 0))
    const carbs = Math.round(Number(s.total_carbs_g ?? 0))
    const fat = Math.round(Number(s.total_fat_g ?? 0))
    const calTarget = s.calorie_target ? Math.round(Number(s.calorie_target)) : null
    const protTarget = s.protein_target_g ? Math.round(Number(s.protein_target_g)) : null

    totalCal += cal
    totalProtein += protein

    const calStatus = calTarget ? ` (target: ${calTarget})` : ''
    const protStatus = protTarget ? ` (target: ${protTarget}g)` : ''

    lines.push(`${formatDate(s.date)}: ${cal} kcal${calStatus}, ${protein}g eiwit${protStatus}, ${carbs}g KH, ${fat}g vet`)

    if (input.include_meals && meals) {
      const dayMeals = meals.filter((m) => m.date === s.date)
      for (const m of dayMeals) {
        const mealCal = Math.round(Number(m.estimated_calories ?? 0))
        const mealProt = Math.round(Number(m.estimated_protein_g ?? 0))
        lines.push(`  ${m.meal_type ?? 'maaltijd'}: ${m.raw_input} (${mealCal} kcal, ${mealProt}g eiwit)`)
      }
    }
  }

  if (summaries.length > 1) {
    const avgCal = Math.round(totalCal / summaries.length)
    const avgProtein = Math.round(totalProtein / summaries.length)
    lines.push(`\nGemiddeld: ${avgCal} kcal/dag, ${avgProtein}g eiwit/dag`)
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// get_macro_targets
// ---------------------------------------------------------------------------

export async function getMacroTargets(userId: string): Promise<string> {
  const admin = createAdminClient()

  const [{ data: settings }, { data: profile }] = await Promise.all([
    admin.from('user_settings').select('protein_target_per_kg').eq('user_id', userId).maybeSingle(),
    admin.from('profiles').select('weight_kg, dietary_preference').eq('id', userId).maybeSingle(),
  ])

  const weight = profile?.weight_kg ? Number(profile.weight_kg) : null
  const protPerKg = settings?.protein_target_per_kg ? Number(settings.protein_target_per_kg) : 1.8
  const proteinTarget = weight ? Math.round(weight * protPerKg) : null

  const lines: string[] = ['Macro targets:\n']
  lines.push(`Calorieën: ~2100 kcal/dag (trainingsdagen), ~1800 kcal/dag (rustdagen)`)
  lines.push(`Eiwit: ${proteinTarget ? `${proteinTarget}g/dag` : '?'} (${protPerKg}g/kg${weight ? ` x ${weight}kg` : ''})`)
  lines.push(`Koolhydraten: ~250g/dag`)
  lines.push(`Vet: ~65g/dag`)
  lines.push(`\nDieet: ${profile?.dietary_preference ?? 'overwegend vegetarisch'}`)
  lines.push(`TDEE schatting: ~2900-3000 kcal (deficit ~400-500 kcal)`)

  return lines.join('\n')
}
