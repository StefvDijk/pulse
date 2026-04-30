import useSWR from 'swr'
import type { BaselineMetric, BaselineWindow, MetricBaselineRow } from '@/lib/baselines/types'

interface BaselinesResponse {
  baselines: MetricBaselineRow[]
}

async function fetcher(url: string): Promise<BaselinesResponse> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useBaselines() {
  const { data, error, isLoading } = useSWR<BaselinesResponse>(
    '/api/baselines',
    fetcher,
    { refreshInterval: 600_000 }, // 10 min
  )

  const baselines = data?.baselines ?? []

  function getBaseline(
    metric: BaselineMetric,
    window: BaselineWindow = '30d',
  ): number | null {
    const row = baselines.find((b) => b.metric === metric)
    if (!row) return null
    if (window === '30d') return row.value_30d_avg
    if (window === '60d') return row.value_60d_avg
    return row.value_365d_avg
  }

  return {
    baselines,
    getBaseline,
    isLoading,
    error: error as Error | undefined,
  }
}
