import useSWR from 'swr'
import type { TodayMove } from '@/app/api/today/route'

async function fetcher(url: string): Promise<TodayMove> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useTodaysMove() {
  const { data, error, isLoading } = useSWR<TodayMove>(
    '/api/today',
    fetcher,
    // Server caches for 24h, but refetch every 30 min so a midday completion
    // can flip a "Training" card into "Rust — afgerond" if the cache expires.
    { refreshInterval: 30 * 60 * 1000 },
  )

  return { data, error: error as Error | undefined, isLoading }
}
