'use client'

import { Card } from '@/components/ui/v2'
import { useSportCorrelations } from '@/hooks/useSportCorrelations'
import { SkeletonCard, SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'
import type { Sport } from '@/lib/load/sport-correlations'

const SPORT_LABELS: Record<Sport, string> = {
  gym: 'Gym',
  run: 'Hardlopen',
  padel: 'Padel',
}

const SPORT_COLOR: Record<Sport, { base: string; light: string }> = {
  gym: { base: '#00E5C7', light: 'rgba(0,229,199,0.18)' },
  run: { base: '#FF5E3A', light: 'rgba(255,94,58,0.18)' },
  padel: { base: '#FFB020', light: 'rgba(255,176,32,0.18)' },
}

export function SportBreakdownCard() {
  const { data, isLoading } = useSportCorrelations()

  if (isLoading) {
    return (
      <SkeletonCard className="flex flex-col gap-4">
        <SkeletonLine width="w-1/3" height="h-4" />
        <SkeletonRect height="h-3" />
        <div className="flex flex-col gap-2">
          <SkeletonLine />
          <SkeletonLine />
          <SkeletonLine />
        </div>
      </SkeletonCard>
    )
  }

  if (!data) return null

  return (
    <Card className="p-[18px]">
      <div className="mb-3.5 text-[16px] font-semibold text-text-primary">Per sport</div>
      {data.fatigue.map((f, i) => {
        const contribution = data.contributions.find((c) => c.sport === f.sport)
        const share = contribution?.share ?? 0
        const c = SPORT_COLOR[f.sport]
        const pct = Math.round(share * 100)

        return (
          <div
            key={f.sport}
            className={`flex items-center gap-3 py-2.5 ${i > 0 ? 'border-t-[0.5px] border-bg-border' : ''}`}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-[10px]"
              style={{ background: c.light }}
            >
              <div
                className="h-3 w-3 rounded-full"
                style={{ background: c.base, boxShadow: `0 0 8px ${c.base}` }}
              />
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-medium text-text-primary">{SPORT_LABELS[f.sport]}</div>
              <div className="mt-0.5 text-[11px] text-text-tertiary tabular-nums">
                fatigue {f.score} · aandeel {pct}%
              </div>
            </div>
            <div
              className="text-[14px] font-semibold tabular-nums"
              style={{ color: pct > 50 ? '#FFB020' : 'rgba(245,245,247,1)' }}
            >
              {pct}%
            </div>
          </div>
        )
      })}
    </Card>
  )
}
