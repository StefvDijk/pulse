'use client'

import Link from 'next/link'
import { ChevronLeft, ClipboardCheck, Calendar } from 'lucide-react'
import { useCheckInHistory } from '@/hooks/useCheckInHistory'
import { SkeletonCard, SkeletonLine } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { formatDateRange } from '@/lib/formatters'

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

function formatCompletedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Amsterdam',
  })
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} className="flex flex-col gap-2">
          <SkeletonLine width="w-2/5" />
          <SkeletonLine width="w-3/5" height="h-3" />
          <SkeletonLine width="w-1/3" height="h-3" />
        </SkeletonCard>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-system-gray6">
        <ClipboardCheck size={24} className="text-label-tertiary" />
      </div>
      <p className="text-headline text-label-primary">Nog geen check-ins</p>
      <p className="text-sm text-label-secondary">
        Na je eerste wekelijkse check-in verschijnt je historie hier.
      </p>
      <Link
        href="/check-in"
        className="mt-2 rounded-xl bg-system-blue px-5 py-2 text-sm font-medium text-white"
      >
        Eerste check-in starten
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// History card
// ---------------------------------------------------------------------------

interface HistoryCardProps {
  weekNumber: number
  weekStart: string
  weekEnd: string
  summaryText: string | null
  sessionsPlanned: number | null
  sessionsCompleted: number | null
  highlightsCount: number
  completedAt: string | null
}

function HistoryCard({
  weekNumber,
  weekStart,
  weekEnd,
  summaryText,
  sessionsPlanned,
  sessionsCompleted,
  highlightsCount,
  completedAt,
}: HistoryCardProps) {
  return (
    <div className="rounded-2xl border border-separator bg-surface-primary p-5 transition-colors hover:bg-system-gray6">
      {/* Week header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-subhead font-semibold text-label-primary">Week {weekNumber}</p>
          <p className="mt-0.5 text-xs text-label-tertiary">
            {formatDateRange(weekStart, weekEnd)}
          </p>
        </div>
        {sessionsCompleted !== null && (
          <div className="flex items-center gap-1.5 rounded-full bg-system-gray6 px-2.5 py-1">
            <span className="text-xs font-medium text-label-secondary">
              {sessionsCompleted}/{sessionsPlanned ?? '?'} sessies
            </span>
          </div>
        )}
      </div>

      {/* Summary */}
      {summaryText && (
        <p className="mt-3 line-clamp-2 text-sm text-label-secondary">
          {summaryText}
        </p>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center gap-4 text-xs text-label-tertiary">
        {completedAt && (
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {formatCompletedDate(completedAt)}
          </span>
        )}
        {highlightsCount > 0 && (
          <span>
            {highlightsCount} highlight{highlightsCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CheckInHistoryPage() {
  const { entries, error, isLoading, refresh } = useCheckInHistory()

  return (
    <div className="mx-auto max-w-lg pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Link
          href="/"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-system-gray6 text-label-tertiary"
        >
          <ChevronLeft size={18} />
        </Link>
        <h1 className="text-headline text-label-primary">Check-in historie</h1>
      </div>

      {/* Content */}
      <div className="px-4 pt-2">
        {isLoading && <HistorySkeleton />}

        {error && !isLoading && (
          <ErrorAlert
            message="Kan check-in historie niet laden."
            onRetry={refresh}
          />
        )}

        {!isLoading && !error && entries.length === 0 && <EmptyState />}

        {!isLoading && !error && entries.length > 0 && (
          <div className="flex flex-col gap-3">
            {entries.map((entry) => (
              <HistoryCard
                key={entry.id}
                weekNumber={entry.weekNumber}
                weekStart={entry.weekStart}
                weekEnd={entry.weekEnd}
                summaryText={entry.summaryText}
                sessionsPlanned={entry.sessionsPlanned}
                sessionsCompleted={entry.sessionsCompleted}
                highlightsCount={entry.highlights.length}
                completedAt={entry.completedAt}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
