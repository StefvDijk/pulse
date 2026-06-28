'use client'

export interface TimeSeparatorProps {
  dateLabel: string
}

export function TimeSeparator({ dateLabel }: TimeSeparatorProps) {
  return (
    <div className="flex items-center gap-3 py-1" role="separator" aria-label={dateLabel}>
      <div className="flex-1 border-t-[0.5px] border-bg-border" />
      <span className="shrink-0 text-[10px] text-text-tertiary">{dateLabel}</span>
      <div className="flex-1 border-t-[0.5px] border-bg-border" />
    </div>
  )
}
