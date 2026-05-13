import useSWR from 'swr'
import type { SettingsData } from '@/types/api'

async function fetcher(url: string): Promise<SettingsData> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Laden mislukt')
  return res.json()
}

export function useSettings() {
  const { data, error, isLoading, mutate } = useSWR<SettingsData>('/api/settings', fetcher)
  return { data, error: error as Error | undefined, isLoading, refresh: mutate }
}
