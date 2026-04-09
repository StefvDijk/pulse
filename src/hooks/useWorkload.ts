import useSWR from 'swr'
import type { WorkloadData } from '@/types/workload'

async function fetcher(url: string): Promise<WorkloadData> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useWorkload() {
  const { data, error, isLoading } = useSWR<WorkloadData>(
    '/api/workload',
    fetcher,
    { refreshInterval: 300_000 },
  )

  return { data, error: error as Error | undefined, isLoading }
}
