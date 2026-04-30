export interface ReadinessOrbProps {
  /** Normalised value 0..1. */
  value: number
  size?: number
  className?: string
}

export function ReadinessOrb({ value, size = 96, className = '' }: ReadinessOrbProps) {
  const r = size / 2 - 4
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, value))
  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div
        className="absolute rounded-full"
        style={{
          inset: -10,
          background: 'radial-gradient(circle, rgba(0,229,199,0.5), transparent 70%)',
          filter: 'blur(8px)',
        }}
      />
      <svg width={size} height={size} className="relative">
        <defs>
          <linearGradient id="orb-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#00E5C7" />
            <stop offset="100%" stopColor="#4FC3F7" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <circle cx={size / 2} cy={size / 2} r={r - 2} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r - 2}
          fill="none"
          stroke="url(#orb-grad)"
          strokeWidth="4"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <circle cx={size / 2} cy={size / 2} r={(r - 2) * 0.55} fill="rgba(0,229,199,0.15)" />
        <circle cx={size / 2} cy={size / 2} r={(r - 2) * 0.35} fill="rgba(0,229,199,0.25)" />
      </svg>
    </div>
  )
}
