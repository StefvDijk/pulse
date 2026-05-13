import useSWR from 'swr'
import type { Database } from '@/types/database'

export type BodyCompEntry = Database['public']['Tables']['body_composition_logs']['Row']

async function fetcher(url: string): Promise<BodyCompEntry[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Laden mislukt')
  return res.json()
}

export function useBodyComposition(limit = 50) {
  const { data, error, isLoading, mutate } = useSWR<BodyCompEntry[]>(
    `/api/body-composition?limit=${limit}`,
    fetcher,
    // [F6] Body composition entries are added at most weekly; tab-focus refetches waste data.
    { revalidateOnFocus: false },
  )

  return {
    entries: data ?? [],
    error: error as Error | undefined,
    isLoading,
    refresh: mutate,
  }
}
