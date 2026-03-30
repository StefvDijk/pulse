import useSWR from 'swr'
import type { Database } from '@/types/database'

type GoalRow = Database['public']['Tables']['goals']['Row']

async function fetcher(url: string): Promise<GoalRow[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Laden mislukt')
  return res.json()
}

export function useGoals() {
  const { data, error, isLoading, mutate } = useSWR<GoalRow[]>('/api/goals', fetcher)
  return { goals: data ?? [], error: error as Error | undefined, isLoading, refresh: mutate }
}
