'use client'

import { useTrendsData } from '@/hooks/useTrendsData'
import { MonthComparison } from './MonthComparison'
import { QuarterComparison } from './QuarterComparison'
import { YearAgoSnapshot } from './YearAgoSnapshot'
import { SkeletonCard, SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { EmptyState } from '@/components/shared/EmptyState'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-primary border border-separator rounded-[14px] p-[14px_16px]">
      <h2 className="mb-4 text-[17px] font-semibold text-label-primary">
        {title}
      </h2>
      {children}
    </div>
  )
}

export function TrendsPage() {
  const { data, isLoading, error, refresh } = useTrendsData()

  const now = new Date()
  const currentMonth = data?.months.find(
    (m) => m.year === now.getUTCFullYear() && m.month === now.getUTCMonth() + 1,
  ) ?? null
  const previousMonth = data?.months.find(
    (m) =>
      now.getUTCMonth() === 0
        ? m.year === now.getUTCFullYear() - 1 && m.month === 12
        : m.year === now.getUTCFullYear() && m.month === now.getUTCMonth(),
  ) ?? null

  return (
    <div className="flex flex-col gap-6 px-4 pb-24 pt-6">
      <h1 className="text-xl font-bold text-label-primary">Trends</h1>

      {error && <ErrorAlert message="Kon data niet laden." onRetry={refresh} />}

      {isLoading ? (
        <TrendsSkeleton />
      ) : data?.months.length === 0 && !data?.currentWeek ? (
        <EmptyState
          title="Nog niet genoeg data voor trends"
          description="Na een paar weken trainen verschijnen hier je vergelijkingen."
        />
      ) : data ? (
        <>
          <Card title="Maand vergelijking">
            <MonthComparison current={currentMonth} previous={previousMonth} />
          </Card>

          <Card title="Kwartaal vergelijking">
            <QuarterComparison months={data.months} />
          </Card>

          <Card title="Een jaar geleden">
            <YearAgoSnapshot
              currentWeek={data.currentWeek}
              sameWeekLastYear={data.sameWeekLastYear}
            />
          </Card>
        </>
      ) : null}
    </div>
  )
}

function TrendsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} className="flex flex-col gap-3">
          <SkeletonLine width="w-1/3" />
          {[1,2,3,4].map(j => (
            <div key={j} className="flex items-center justify-between gap-3">
              <SkeletonLine width="w-1/4" height="h-3" />
              <SkeletonLine width="w-1/5" height="h-3" />
              <SkeletonLine width="w-1/5" height="h-3" />
            </div>
          ))}
        </SkeletonCard>
      ))}
    </div>
  )
}
