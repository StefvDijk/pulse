import useSWR from 'swr'
import type { ProgressData, Period } from '@/app/api/progress/route'

async function fetcher(url: string): Promise<ProgressData> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Laden mislukt')
  return res.json()
}

export function useProgressData(period: Period = '4w') {
  const { data, error, isLoading, mutate } = useSWR<ProgressData>(
    `/api/progress?period=${period}`,
    fetcher,
    { revalidateOnFocus: false },
  )
  return { data, error: error as Error | undefined, isLoading, refresh: mutate }
}
