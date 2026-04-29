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
  const { data, error, isLoading } = useSWR<ReadinessSummary>(
    '/api/readiness/summary',
    fetcher,
    // Server caches for 4h; refresh hourly so a freshly-arrived sleep / HRV
    // value can flow into the displayed sentence within a reasonable window.
    { refreshInterval: 60 * 60 * 1000 },
  )

  return { data, error: error as Error | undefined, isLoading }
}
