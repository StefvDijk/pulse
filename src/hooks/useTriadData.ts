import useSWR from 'swr'
import type { TriadData } from '@/app/api/triad/route'

async function fetcher(url: string): Promise<TriadData> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useTriadData() {
  const { data, error, isLoading } = useSWR<TriadData>(
    '/api/triad',
    fetcher,
    { refreshInterval: 5 * 60 * 1000 },
  )

  return { data, error: error as Error | undefined, isLoading }
}
