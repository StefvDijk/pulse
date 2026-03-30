import useSWR from 'swr'
import type { TrendsData } from '@/app/api/trends/route'

async function fetcher(url: string): Promise<TrendsData> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Laden mislukt')
  return res.json()
}

export function useTrendsData() {
  const { data, error, isLoading, mutate } = useSWR<TrendsData>('/api/trends', fetcher, {
    revalidateOnFocus: false,
  })
  return { data, error: error as Error | undefined, isLoading, refresh: mutate }
}
