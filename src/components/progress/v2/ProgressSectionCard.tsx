import type { ReactNode } from 'react'

/**
 * ProgressSectionCard — v2 card shell for Progress page sections.
 * Matches the Card component used in Progress (screens/Other.jsx):
 * eyebrow label, title with delta, content area.
 */
export interface ProgressSectionCardProps {
  eyebrow?: string
  title: ReactNode
  children: ReactNode
  className?: string
}

export function ProgressSectionCard({
  eyebrow,
  title,
  children,
  className = '',
}: ProgressSectionCardProps) {
  return (
    <div
      className={`rounded-[22px] bg-bg-surface border-[0.5px] border-bg-border p-4 ${className}`}
    >
      {eyebrow && (
        <div className="text-[11px] font-semibold uppercase tracking-[0.6px] text-text-tertiary mb-1">
          {eyebrow}
        </div>
      )}
      {title && (
        <div className="text-[17px] font-semibold text-text-primary mb-3">{title}</div>
      )}
      {children}
    </div>
  )
}

/**
 * ProgressMetricCard — card showing a large metric with optional delta.
 * For the Strength and Running summary cards.
 */
export interface ProgressMetricCardProps {
  eyebrow: string
  metric: string
  delta?: string
  deltaPositive?: boolean
  children?: ReactNode
}

export function ProgressMetricCard({
  eyebrow,
  metric,
  delta,
  deltaPositive = true,
  children,
}: ProgressMetricCardProps) {
  return (
    <div className="rounded-[22px] bg-bg-surface border-[0.5px] border-bg-border p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.6px] text-text-tertiary">
            {eyebrow}
          </div>
          <div className="mt-1 text-[22px] font-bold tracking-[-0.4px] text-text-primary tabular-nums">
            {metric}
            {delta && (
              <span
                className="ml-2 text-[13px] font-medium"
                style={{ color: deltaPositive ? 'var(--color-status-good)' : 'var(--color-status-bad)' }}
              >
                {delta}
              </span>
            )}
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}
