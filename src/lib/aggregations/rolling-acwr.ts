import { createAdminClient } from '@/lib/supabase/admin'
import { addDaysToKey, daysAgoAmsterdam, todayAmsterdam } from '@/lib/time/amsterdam'

/**
 * Rollend acute:chronic workload ratio (ACWR) over een venster dat ECHT op
 * vandaag eindigt.
 *
 * Waarom dit bestaat: `weekly_aggregations.acute_chronic_ratio` is de som van de
 * LOPENDE kalenderweek gedeeld door 7. Vroeg in de week (bv. dinsdag) is die som
 * nog laag, dus de ratio zakt onterecht naar ~0.2-0.4 en lezers concluderen
 * "fatigued" / "low load". Een rollend venster van de laatste 7 (acute) en 28
 * (chronic) dagen lost dat op — dit is dezelfde conventie als
 * `/api/workload` (computePoint).
 *
 * Ontbrekende dagen tellen als 0 (rustdag), per sports-science conventie.
 * `ratio` is `null` wanneer er geen chronische basislijn is (chronic load 0):
 * dan is er niets om mee te vergelijken. We verzinnen GEEN 1.0 — dat zou na een
 * vakantie of datagat een vals "optimaal" suggereren.
 */

const ACUTE_DAYS = 7
const CHRONIC_DAYS = 28

export interface RollingAcwr {
  acute: number
  chronic: number
  ratio: number | null
}

export async function computeRollingAcwr(userId: string): Promise<RollingAcwr> {
  const admin = createAdminClient()

  const today = todayAmsterdam()
  const chronicStart = daysAgoAmsterdam(CHRONIC_DAYS - 1)
  const acuteStart = daysAgoAmsterdam(ACUTE_DAYS - 1)

  const { data, error } = await admin
    .from('daily_aggregations')
    .select('date, training_load_score')
    .eq('user_id', userId)
    .gte('date', chronicStart)
    .lte('date', today)

  if (error) {
    console.error('computeRollingAcwr: failed to fetch daily aggregations:', error)
    throw new Error('Kon rollende ACWR niet berekenen')
  }

  const dayMap = new Map<string, number>()
  for (const row of data ?? []) {
    dayMap.set(row.date, row.training_load_score ?? 0)
  }

  let acuteSum = 0
  let chronicSum = 0
  for (let i = 0; i < CHRONIC_DAYS; i++) {
    const date = addDaysToKey(chronicStart, i)
    const load = dayMap.get(date) ?? 0
    chronicSum += load
    if (date >= acuteStart) acuteSum += load
  }

  const acute = acuteSum / ACUTE_DAYS
  const chronic = chronicSum / CHRONIC_DAYS
  const ratio = chronic > 0 ? acute / chronic : null

  return {
    acute: parseFloat(acute.toFixed(1)),
    chronic: parseFloat(chronic.toFixed(1)),
    ratio: ratio !== null ? parseFloat(ratio.toFixed(2)) : null,
  }
}
