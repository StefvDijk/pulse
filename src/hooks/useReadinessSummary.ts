import useSWR from 'swr'
import type { ReadinessSummary } from '@/app/api/readiness/summary/route'

async function fetcher(url: string): Promise<ReadinessSummary> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useReadinessSummary() {
  const { data, error, isLoading, mutate } = useSWR<ReadinessSummary>(
    '/api/readiness/summary',
    fetcher,
    // Match the dashboard's refresh cadence. The server checks fresh inputs on
    // each request and only reuses AI text while those inputs are unchanged.
    { refreshInterval: 60 * 1000 },
  )

  return { data, error: error as Error | undefined, isLoading, refresh: () => mutate() }
}
