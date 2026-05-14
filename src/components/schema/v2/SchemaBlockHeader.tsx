'use client'

/**
 * SchemaBlockHeader — v2 design reference header for the Schema page.
 * Shows block title, week-of-block progress bar, and session counters.
 * Mirrors SchemaWeek header in screens/Other.jsx.
 */

interface SchemaBlockHeaderProps {
  title: string
  weekLabel: string
  weekOfBlock: number
  totalWeeks: number
  sessionsCompleted: number
  sessionsPlanned: number
  phaseName?: string
}

export interface SchemaBlockHeaderPropsExport extends SchemaBlockHeaderProps {}

export function SchemaBlockHeader({
  title,
  weekLabel,
  weekOfBlock,
  totalWeeks,
  sessionsCompleted,
  sessionsPlanned,
  phaseName,
}: SchemaBlockHeaderProps) {
  const progress = totalWeeks > 0 ? (weekOfBlock - 1) / totalWeeks : 0
  const daysLeft = (totalWeeks - weekOfBlock) * 7

  return (
    <div className="px-4 pt-[64px] pb-3">
      <div className="text-[13px] font-medium text-text-tertiary tracking-[0.2px]">
        Schema · {weekLabel}
      </div>
      <h1 className="mt-0.5 text-[28px] font-bold leading-[1.1] tracking-[-0.6px] text-text-primary">
        {title}
      </h1>
      <p className="mt-1.5 text-[13px] text-text-secondary">
        Week {weekOfBlock} van {totalWeeks}
        {phaseName ? ` · ${phaseName}` : ''}
      </p>

      {/* Progress bar */}
      <div className="mt-3.5 h-[6px] rounded-full overflow-hidden bg-white/[0.06]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(progress * 100, 100)}%`,
            background: 'linear-gradient(90deg, #00E5C7, #7C3AED)',
          }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-text-tertiary">
        <span className="tabular-nums">
          {sessionsCompleted} / {sessionsPlanned} sessies
        </span>
        {daysLeft > 0 && <span>{daysLeft} dagen te gaan</span>}
      </div>
    </div>
  )
}
