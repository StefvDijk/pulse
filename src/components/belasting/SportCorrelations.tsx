'use client'

import type { Sport, SportCorrelations as SportCorrelationsData } from '@/lib/load/sport-correlations'
import { useSportCorrelations } from '@/hooks/useSportCorrelations'
import { SkeletonCard, SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'

const SPORT_LABELS: Record<Sport, string> = {
  gym: 'Gym',
  run: 'Hardlopen',
  padel: 'Padel',
}

const SPORT_COLOR_VAR: Record<Sport, string> = {
  gym: 'var(--color-sport-gym-base)',
  run: 'var(--color-sport-run-base)',
  padel: 'var(--color-sport-padel-base)',
}

function ContributionBar({ data }: { data: SportCorrelationsData }) {
  const hasData = data.contributions.some((c) => c.share > 0)
  if (!hasData) {
    return (
      <div className="h-3 w-full rounded-full bg-system-gray6" aria-label="Geen sport-data deze week" />
    )
  }

  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-system-gray6" role="img" aria-label="Verdeling belasting per sport, afgelopen 7 dagen">
      {data.contributions.map((c) =>
        c.share > 0 ? (
          <div
            key={c.sport}
            style={{ width: `${c.share * 100}%`, backgroundColor: SPORT_COLOR_VAR[c.sport] }}
            title={`${SPORT_LABELS[c.sport]}: ${Math.round(c.share * 100)}%`}
          />
        ) : null,
      )}
    </div>
  )
}

function FatigueRow({
  sport,
  score,
  share,
}: {
  sport: Sport
  score: number
  share: number
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: SPORT_COLOR_VAR[sport] }}
        aria-hidden="true"
      />
      <span className="flex-1 text-subhead font-medium text-text-primary">
        {SPORT_LABELS[sport]}
      </span>
      <span className="text-caption1 tabular-nums text-text-tertiary">
        {Math.round(share * 100)}%
      </span>
      <div className="relative h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-system-gray6">
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, backgroundColor: SPORT_COLOR_VAR[sport] }}
        />
      </div>
      <span className="w-8 text-right text-footnote font-semibold tabular-nums text-text-primary">
        {score}
      </span>
    </div>
  )
}

export function SportCorrelations() {
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

  const allZero = data.fatigue.every((f) => f.score === 0)

  return (
    <section className="rounded-3xl border border-bg-border bg-bg-surface p-6 shadow-apple-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-caption2 font-semibold uppercase tracking-wider text-text-tertiary">
          Per sport · laatste 72u
        </h3>
        <span className="text-caption1 text-text-tertiary">7-daags aandeel</span>
      </div>

      <div className="mt-3 flex flex-col gap-2.5">
        {data.fatigue.map((f) => {
          const contribution = data.contributions.find((c) => c.sport === f.sport)
          return (
            <FatigueRow
              key={f.sport}
              sport={f.sport}
              score={f.score}
              share={contribution?.share ?? 0}
            />
          )
        })}
      </div>

      <div className="mt-5">
        <p className="mb-2 text-caption2 font-semibold uppercase tracking-wider text-text-tertiary">
          Verdeling 7 dagen
        </p>
        <ContributionBar data={data} />
      </div>

      {allZero && (
        <p className="mt-4 text-caption1 text-text-tertiary">
          Nog geen sport-belasting in de laatste 72u — train op gevoel.
        </p>
      )}
    </section>
  )
}
