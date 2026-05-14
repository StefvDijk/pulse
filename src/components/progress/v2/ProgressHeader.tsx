/**
 * ProgressHeader — v2 page header for Progressie page.
 * Shows title + period selector tab bar (SegmentedControl-style).
 * Matches the header + period selector in Progress (screens/Other.jsx).
 */

export type ProgressPeriod = '4w' | '3m' | '6m' | '1y'

const PERIOD_LABELS: Record<ProgressPeriod, string> = {
  '4w': '4 weken',
  '3m': '3 mnd',
  '6m': '6 mnd',
  '1y': 'Jaar',
}

const PERIODS: ProgressPeriod[] = ['4w', '3m', '6m', '1y']

export interface ProgressHeaderProps {
  selectedPeriod: ProgressPeriod
  onPeriodChange: (period: ProgressPeriod) => void
}

export function ProgressHeader({ selectedPeriod, onPeriodChange }: ProgressHeaderProps) {
  return (
    <div className="px-4 pt-[64px] pb-3">
      <h1 className="text-[28px] font-bold tracking-[-0.6px] text-text-primary">Progressie</h1>

      {/* Period selector */}
      <div
        className="mt-3.5 flex gap-1.5 p-1 rounded-[12px]"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '0.5px solid rgba(255,255,255,0.06)',
        }}
      >
        {PERIODS.map((period) => {
          const isActive = period === selectedPeriod
          return (
            <button
              key={period}
              onClick={() => onPeriodChange(period)}
              className="flex-1 h-8 rounded-[8px] text-[12px] font-semibold transition-colors active:opacity-60"
              style={{
                background: isActive ? 'rgba(255,255,255,0.10)' : 'transparent',
                color: isActive
                  ? 'var(--color-text-primary)'
                  : 'var(--color-text-secondary)',
                border: 'none',
              }}
            >
              {PERIOD_LABELS[period]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
