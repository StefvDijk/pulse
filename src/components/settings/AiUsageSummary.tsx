'use client'

import useSWR from 'swr'
import type { AiUsageResponse, AiUsageFeature } from '@/app/api/ai-usage/route'

// AI usage + estimated cost over the trailing 30 days, grouped by feature
// (audit #25). Until this existed, ai_usage_log was written on every AI call
// but never read anywhere — spend was invisible. Cost is an estimate from a
// static price table (lib/ai/pricing.ts), hence the "geschat" label.

const FEATURE_LABELS: Record<string, string> = {
  chat: 'Chat',
  chat_greeting: 'Chat (begroeting)',
  chat_suggestions: 'Chat-suggesties',
  block_review: 'Blok-review',
  block_review_analyse: 'Blok-review analyse',
  check_in_plan: 'Check-in weekplan',
  check_in_plan_refine: 'Check-in plan bijwerken',
  check_in_dialog: 'Check-in dialoog',
  check_in_analyze: 'Check-in analyse',
  readiness_summary: 'Readiness-zin',
  today_subtitle: 'Vandaag-zin',
  health_check: 'Health-check',
  nutrition_analyze: 'Voeding-analyse',
  memory_extractor: 'Geheugen-extractie',
  'belief-extractor': 'Belief-extractie',
  sport_insight: 'Sport-inzichten',
  weekly_lessons: 'Wekelijkse lessen',
  sync_analyst: 'Sync-analyse',
  explain: 'Uitleg',
}

const fetcher = async (url: string): Promise<AiUsageResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Kon AI-gebruik niet laden')
  return res.json() as Promise<AiUsageResponse>
}

function formatCost(usd: number): string {
  // Sub-cent totals still matter at this scale — show 3 decimals under $1.
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return String(n)
}

function featureLabel(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature
}

function FeatureRow({ entry }: { entry: AiUsageFeature }) {
  const tokens = entry.inputTokens + entry.outputTokens + entry.cacheReadTokens + entry.cacheCreationTokens
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <div className="min-w-0 flex-1">
        <span className="text-text-secondary">{featureLabel(entry.feature)}</span>
        {entry.errorCount > 0 && (
          <span className="ml-1.5 text-status-bad">⚠ {entry.errorCount}</span>
        )}
      </div>
      <span className="shrink-0 text-text-tertiary">
        {entry.calls}× · {formatTokens(tokens)} tk
      </span>
      <span className="w-16 shrink-0 text-right text-text-primary tabular-nums">
        {formatCost(entry.estimatedCostUsd)}
      </span>
    </div>
  )
}

export function AiUsageSummary() {
  const { data, error } = useSWR<AiUsageResponse>('/api/ai-usage', fetcher, {
    refreshInterval: 60000,
  })

  if (error) return null
  if (!data) {
    return <p className="text-xs text-text-tertiary">AI-gebruik laden…</p>
  }

  if (data.totalCalls === 0) {
    return (
      <p className="text-xs text-text-tertiary">
        Nog geen AI-calls in de laatste {data.windowDays} dagen.
      </p>
    )
  }

  const cacheBase = data.inputTokens + data.cacheReadTokens
  const cacheHitPct = cacheBase > 0 ? Math.round((data.cacheReadTokens / cacheBase) * 100) : 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-semibold text-text-primary tabular-nums">
            {formatCost(data.totalCostUsd)}
          </p>
          <p className="text-[11px] text-text-tertiary">
            geschat · {data.totalCalls} calls · laatste {data.windowDays} dagen
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-text-secondary tabular-nums">{cacheHitPct}%</p>
          <p className="text-[11px] text-text-tertiary">cache-hit</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-bg-border pt-3">
        {data.byFeature.map((entry) => (
          <FeatureRow key={entry.feature} entry={entry} />
        ))}
      </div>

      {data.truncated && (
        <p className="text-[11px] text-text-tertiary">
          Alleen de recentste calls geteld — werkelijke kosten liggen hoger.
        </p>
      )}
    </div>
  )
}
