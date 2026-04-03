import useSWR from 'swr'
import type { Database } from '@/types/database'

export type BodyCompEntry = Database['public']['Tables']['body_composition_logs']['Row']

export interface BodyCompDelta {
  weight_kg: number | null
  muscle_mass_kg: number | null
  fat_mass_kg: number | null
  fat_pct: number | null
  waist_cm: number | null
}

async function fetcher(url: string): Promise<BodyCompEntry[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Laden mislukt')
  return res.json()
}

export function useBodyComposition(limit = 10) {
  const { data, error, isLoading, mutate } = useSWR<BodyCompEntry[]>(
    `/api/body-composition?limit=${limit}`,
    fetcher,
  )

  return {
    entries: data ?? [],
    error: error as Error | undefined,
    isLoading,
    refresh: mutate,
  }
}
