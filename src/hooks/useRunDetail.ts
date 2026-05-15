import useSWR from 'swr'
import type { RunDetailData } from '@/app/api/runs/[id]/route'

async function fetcher(url: string): Promise<RunDetailData> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useRunDetail(id: string) {
  const { data, error, isLoading } = useSWR<RunDetailData>(`/api/runs/${id}`, fetcher)
  return { run: data, error: error as Error | undefined, isLoading }
}

export type { RunDetailData }
