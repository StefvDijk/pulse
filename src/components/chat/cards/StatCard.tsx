'use client'

import type { StatCardData } from '@/lib/ai/chat/cards'

const TREND_ICON: Record<string, string> = { up: '↑', down: '↓', flat: '→' }
const TREND_COLOR: Record<string, string> = {
  up: 'text-status-good', down: 'text-status-bad', flat: 'text-text-tertiary',
}

export interface StatCardProps { data: StatCardData }

export function StatCard({ data }: StatCardProps) {
  return (
    <div className="mt-2 rounded-[13px] border-[0.5px] border-white/[0.08] bg-white/[0.04] px-3 py-2.5">
      <p className="text-caption1 text-text-tertiary">{data.label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[22px] font-bold leading-none text-text-primary">{data.value}</span>
        {data.unit && <span className="text-body text-text-secondary">{data.unit}</span>}
        {data.trend && (
          <span
            className={`ml-auto text-body font-semibold ${TREND_COLOR[data.trend] ?? 'text-text-tertiary'}`}
          >
            {TREND_ICON[data.trend]}
          </span>
        )}
      </div>
      {data.context && (
        <p className="mt-0.5 text-[11px] text-text-tertiary">{data.context}</p>
      )}
    </div>
  )
}
