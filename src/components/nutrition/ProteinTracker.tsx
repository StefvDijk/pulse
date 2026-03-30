'use client'

export interface ProteinTrackerProps {
  current: number
  target: number
}

function getBarColor(pct: number): string {
  if (pct >= 90) return '#22c55e'
  if (pct >= 70) return '#f59e0b'
  return '#ef4444'
}

export function ProteinTracker({ current, target }: ProteinTrackerProps) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0
  const color = getBarColor(pct)
  const remaining = Math.max(target - current, 0)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: '#f0f0f5' }}>
          {Math.round(current)}g / {target}g eiwit
        </span>
        {remaining > 0 && (
          <span className="text-xs" style={{ color: '#8888a0' }}>
            nog {Math.round(remaining)}g
          </span>
        )}
      </div>
      <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: '#1a1a2e' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
