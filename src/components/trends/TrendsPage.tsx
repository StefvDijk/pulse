'use client'

import { useTrendsData } from '@/hooks/useTrendsData'
import { MonthComparison } from './MonthComparison'
import { QuarterComparison } from './QuarterComparison'
import { YearAgoSnapshot } from './YearAgoSnapshot'
import { Card } from '@/components/ui/v2'
import { SkeletonCard, SkeletonLine } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { EmptyState } from '@/components/shared/EmptyState'

interface SectionCardProps {
  title: string
  sub?: string
  children: React.ReactNode
  yearAgo?: boolean
}

function SectionCard({ title, sub, children, yearAgo }: SectionCardProps) {
  if (yearAgo) {
    return (
      <div
        className="rounded-[22px] border-[0.5px] p-[18px]"
        style={{
          background: 'linear-gradient(135deg, rgba(255,94,58,0.10), rgba(124,58,237,0.10))',
          borderColor: 'rgba(255,94,58,0.20)',
        }}
      >
        <div
          className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.4px]"
          style={{ color: '#FF7A52' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" />
          </svg>
          {title}
        </div>
        {sub && <div className="mt-2 text-[13px] text-text-secondary">{sub}</div>}
        <div className="mt-3">{children}</div>
      </div>
    )
  }
  return (
    <Card className="p-[18px]">
      <div className="text-[16px] font-semibold text-text-primary">{title}</div>
      {sub && <div className="mb-3 mt-1 text-[12px] text-text-tertiary">{sub}</div>}
      {!sub && <div className="mb-3" />}
      {children}
    </Card>
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
    <div className="flex flex-col gap-3.5 px-4 pb-24 pt-[60px]">
      <div className="pt-1">
        <h1 className="text-[34px] font-bold tracking-[-0.8px] text-text-primary">Trends</h1>
        <div className="mt-1 text-[13px] text-text-tertiary">Hoe je nu presteert vs. vroeger</div>
      </div>

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
          <SectionCard title="Maand vs maand" sub="Maand-op-maand vergelijking">
            <MonthComparison current={currentMonth} previous={previousMonth} />
          </SectionCard>

          <SectionCard title="Kwartaal" sub="Totaal volume per maand">
            <QuarterComparison months={data.months} />
          </SectionCard>

          <SectionCard title="Een jaar geleden" yearAgo>
            <YearAgoSnapshot
              currentWeek={data.currentWeek}
              sameWeekLastYear={data.sameWeekLastYear}
            />
          </SectionCard>
        </>
      ) : null}
    </div>
  )
}

function TrendsSkeleton() {
  return (
    <div className="flex flex-col gap-3.5">
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} className="flex flex-col gap-3">
          <SkeletonLine width="w-1/3" />
          {[1, 2, 3, 4].map((j) => (
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
