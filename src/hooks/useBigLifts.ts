import useSWR from 'swr'
import type { BigLiftsResponse } from '@/app/api/progress/big-lifts/route'

async function fetcher(url: string): Promise<BigLiftsResponse> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useBigLifts() {
  const { data, error, isLoading } = useSWR<BigLiftsResponse>(
    '/api/progress/big-lifts',
    fetcher,
  )

  return {
    bigLifts: data?.bigLifts ?? [],
    error: error as Error | undefined,
    isLoading,
  }
}
