'use client'

interface ZoneBarProps {
  ratio: number
}

interface Zone {
  key: 'low' | 'optimal' | 'warning' | 'danger'
  label: string
  start: number
  end: number
  fill: string
}

const MAX_RATIO = 2.0

const ZONES: readonly Zone[] = [
  { key: 'low', label: 'Te licht', start: 0, end: 0.6, fill: 'var(--color-system-gray3)' },
  { key: 'optimal', label: 'In balans', start: 0.6, end: 1.3, fill: 'var(--color-system-green)' },
  { key: 'warning', label: 'Opbouw', start: 1.3, end: 1.5, fill: 'var(--color-system-orange)' },
  { key: 'danger', label: 'Overbelast', start: 1.5, end: 2.0, fill: 'var(--color-system-red)' },
]

const TICKS = [0.6, 1.3, 1.5] as const

/**
 * Horizontal segmented zone bar showing where the current ACWR falls.
 *
 * Layout:
 *   - Pointer above the bar with the current ratio
 *   - 4 colored segments, proportional to their ratio range
 *   - Tick values below the bar (0.6, 1.3, 1.5)
 *   - Color-coded zone legend underneath
 */
export function ZoneBar({ ratio }: ZoneBarProps) {
  const clamped = Math.min(Math.max(ratio, 0), MAX_RATIO)
  const pointerPct = (clamped / MAX_RATIO) * 100

  return (
    <div className="flex flex-col gap-3">
      {/* Pointer + bar */}
      <div className="relative pt-7">
        {/* Pointer with current ratio above bar */}
        <div
          className="absolute top-0 flex flex-col items-center -translate-x-1/2"
          style={{ left: `${pointerPct}%` }}
        >
          <span className="text-caption1 font-semibold tabular-nums text-text-primary">
            {ratio.toFixed(2)}
          </span>
          <svg
            width="10"
            height="6"
            viewBox="0 0 10 6"
            className="mt-0.5"
            aria-hidden="true"
          >
            <path d="M5 6 L0 0 L10 0 Z" fill="var(--color-label-primary)" />
          </svg>
        </div>

        {/* Segmented bar */}
        <div className="flex h-2.5 gap-px overflow-hidden rounded-full">
          {ZONES.map((zone) => {
            const width = ((zone.end - zone.start) / MAX_RATIO) * 100
            return (
              <div
                key={zone.key}
                style={{ width: `${width}%`, backgroundColor: zone.fill }}
              />
            )
          })}
        </div>

        {/* Tick values */}
        <div className="relative mt-1.5 h-3">
          {TICKS.map((tick) => (
            <span
              key={tick}
              className="absolute -translate-x-1/2 text-[10px] tabular-nums text-text-tertiary"
              style={{ left: `${(tick / MAX_RATIO) * 100}%` }}
            >
              {tick.toFixed(1)}
            </span>
          ))}
        </div>
      </div>

      {/* Zone legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {ZONES.map((zone) => (
          <div key={zone.key} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: zone.fill }}
              aria-hidden="true"
            />
            <span className="text-caption1 text-text-secondary">{zone.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
