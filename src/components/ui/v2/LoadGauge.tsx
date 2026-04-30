export interface LoadGaugeProps {
  value: number
  color?: string
  className?: string
}

export function LoadGauge({ value, color = '#22D67A', className = '' }: LoadGaugeProps) {
  const r = 22
  const cx = 30
  const cy = 30
  const c = Math.PI * r
  const clamped = Math.max(0, Math.min(1, value))
  return (
    <svg width="60" height="36" viewBox="0 0 60 36" className={className} aria-hidden="true">
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - clamped)}
      />
    </svg>
  )
}
