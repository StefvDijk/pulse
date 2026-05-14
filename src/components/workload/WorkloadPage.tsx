'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { NavBar } from '@/components/ui/NavBar'
import { useWorkload } from '@/hooks/useWorkload'
import { AcwrCorridor } from './AcwrCorridor'
import { SportInsightCard } from '@/components/belasting/SportInsightCard'
import { Card } from '@/components/ui/v2'
import { SkeletonCard, SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { RatioCard } from './v2/RatioCard'
import { WorkloadStatsGrid } from './v2/WorkloadStatsGrid'
import { WorkloadExplainerCard } from './v2/WorkloadExplainerCard'
import { SportBreakdownCard } from './v2/SportBreakdownCard'

export function WorkloadPage() {
  const { data, isLoading, error } = useWorkload()

  return (
    <>
      <NavBar
        variant="inline"
        leading={
          <Link
            href="/"
            className="flex items-center gap-0.5 text-[#0A84FF] active:opacity-60 transition-opacity"
            aria-label="Terug naar home"
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
            <span className="text-[17px] tracking-[-0.2px]">Terug</span>
          </Link>
        }
        title="Belasting"
      />

      <div className="flex flex-col gap-3.5 px-4 pb-24 pt-4">
        <div>
          <h1 className="text-[34px] font-bold tracking-[-0.8px] text-text-primary">Belasting</h1>
          <div className="mt-1 text-[13px] text-text-tertiary">
            Acute vs. chronische belasting · laatste 28 dagen
          </div>
        </div>

        {isLoading && (
          <SkeletonCard className="flex flex-col gap-4">
            <SkeletonLine width="w-1/2" height="h-7" />
            <SkeletonRect height="h-20" />
          </SkeletonCard>
        )}

        {error && <ErrorAlert message="Kon belasting niet laden." />}

        {data && (
          <>
            <RatioCard data={data} />

            {data.trend.length > 0 && (
              <Card className="p-[18px]">
                <div className="mb-3 flex items-baseline justify-between">
                  <div className="text-[16px] font-semibold text-text-primary">
                    Corridor · {data.trend.length} weken
                  </div>
                  <div className="text-[11px] text-text-tertiary">blijf in de groene band</div>
                </div>
                <AcwrCorridor points={data.trend} />
              </Card>
            )}

            <WorkloadStatsGrid data={data} />

            <SportBreakdownCard />

            <SportInsightCard />

            <WorkloadExplainerCard />
          </>
        )}
      </div>
    </>
  )
}
