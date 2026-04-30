import type { ReactNode } from 'react'
import { Card } from './Card'

type Tone = 'good' | 'warn' | 'bad' | 'neutral'

const TONE: Record<Tone, string> = {
  good: 'text-[var(--color-status-good)]',
  warn: 'text-[var(--color-status-warn)]',
  bad: 'text-[var(--color-status-bad)]',
  neutral: 'text-text-secondary',
}

export interface StatCardProps {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: Tone
  progress?: number
  progressColor?: string
  topRight?: ReactNode
  className?: string
}

export function StatCard({
  label,
  value,
  sub,
  tone = 'neutral',
  progress,
  progressColor = '#00E5C7',
  topRight,
  className = '',
}: StatCardProps) {
  return (
    <Card className={`p-[14px] ${className}`}>
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.6px] text-text-tertiary">{label}</div>
        {topRight}
      </div>
      <div className="mt-1.5 text-[26px] font-bold tracking-[-0.6px] text-text-primary tabular-nums">{value}</div>
      {sub && <div className={`mt-0.5 text-[12px] font-medium ${TONE[tone]}`}>{sub}</div>}
      {progress !== undefined && (
        <div className="mt-2.5 h-1 overflow-hidden rounded-sm bg-white/[0.06]">
          <div
            className="h-full rounded-sm"
            style={{
              width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
              background: progressColor,
            }}
          />
        </div>
      )}
    </Card>
  )
}

export interface MicroStatProps {
  label: string
  value: ReactNode
  delta?: string
  good?: boolean
  className?: string
}

export function MicroStat({ label, value, delta, good, className = '' }: MicroStatProps) {
  return (
    <div className={className}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.6px] text-text-tertiary">{label}</div>
      <div className="mt-0.5 text-[16px] font-bold tracking-[-0.3px] tabular-nums">{value}</div>
      {delta && (
        <div
          className={`text-[10px] font-medium ${good ? 'text-[var(--color-status-good)]' : 'text-text-secondary'}`}
        >
          {delta}
        </div>
      )}
    </div>
  )
}
