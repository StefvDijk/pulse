'use client'

export type WorkloadStatus = 'low' | 'optimal' | 'warning' | 'danger'

export interface WorkloadMeterProps {
  ratio: number
  status: WorkloadStatus
}

const STATUS_LABELS: Record<WorkloadStatus, string> = {
  low: 'Weinig belasting',
  optimal: 'Optimaal',
  warning: 'Pas op',
  danger: 'Gevaarlijk',
}

const STATUS_COLORS: Record<WorkloadStatus, string> = {
  low: '#A8A29E',
  optimal: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
}

/**
 * Semi-circle SVG gauge showing the acute:chronic workload ratio.
 * The arc spans 180° (left to right, top half).
 */
export function WorkloadMeter({ ratio, status }: WorkloadMeterProps) {
  const cx = 100
  const cy = 90
  const r = 70
  const strokeWidth = 14

  // Arc helper: polar to cartesian (0° = left, 180° = right, measured from left along top)
  function polarToCartesian(angleDeg: number) {
    const angleRad = (Math.PI * angleDeg) / 180
    return {
      x: cx + r * Math.cos(Math.PI - angleRad),
      y: cy - r * Math.sin(angleRad),
    }
  }

  function arcPath(startDeg: number, endDeg: number) {
    const start = polarToCartesian(startDeg)
    const end = polarToCartesian(endDeg)
    const largeArc = endDeg - startDeg > 180 ? 1 : 0
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
  }

  // Needle angle: map ratio 0–2+ → 0°–180°
  const needleAngle = Math.min(Math.max(ratio / 2, 0), 1) * 180
  const needleEnd = polarToCartesian(needleAngle)
  const needleBase1 = polarToCartesian(needleAngle - 90)
  const needleBase2 = polarToCartesian(needleAngle + 90)

  // Small triangle needle points
  const nx = cx + (r - 20) * Math.cos(Math.PI - (Math.PI * needleAngle) / 180)
  const ny = cy - (r - 20) * Math.sin((Math.PI * needleAngle) / 180)

  const color = STATUS_COLORS[status]

  return (
    <div className="flex flex-col items-center">
      <svg width="200" height="110" viewBox="0 0 200 110" aria-label="Workload meter">
        {/* Background track */}
        <path
          d={arcPath(0, 180)}
          fill="none"
          stroke="#E7E5E0"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Zone arcs */}
        {/* low: 0°–54° (ratio 0–0.6) */}
        <path
          d={arcPath(0, 54)}
          fill="none"
          stroke="#D4D0C8"
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
        />
        {/* optimal: 54°–117° (ratio 0.6–1.3) */}
        <path
          d={arcPath(54, 117)}
          fill="none"
          stroke="#16A34A"
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
        />
        {/* warning: 117°–135° (ratio 1.3–1.5) */}
        <path
          d={arcPath(117, 135)}
          fill="none"
          stroke="#D97706"
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
        />
        {/* danger: 135°–180° (ratio 1.5–2+) */}
        <path
          d={arcPath(135, 180)}
          fill="none"
          stroke="#DC2626"
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
        />

        {/* Active indicator dot */}
        <circle cx={needleEnd.x} cy={needleEnd.y} r={7} fill={color} />

        {/* Center ratio text */}
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#1C1917"
          fontSize="22"
          fontWeight="bold"
        >
          {ratio.toFixed(2)}
        </text>
      </svg>

      {/* Status label */}
      <span className="mt-1 text-sm font-medium" style={{ color }}>
        {STATUS_LABELS[status]}
      </span>
    </div>
  )
}
