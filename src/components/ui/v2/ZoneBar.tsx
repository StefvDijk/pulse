interface Zone {
  size: number
  color: string
  alpha?: number
}

const DEFAULT_ZONES: Zone[] = [
  { size: 0.25, color: '#FF4D6D' },
  { size: 0.17, color: '#FFB020' },
  { size: 0.36, color: '#22D67A' },
  { size: 0.14, color: '#FFB020' },
  { size: 0.08, color: '#FF4D6D' },
]

export interface ZoneBarProps {
  /** Indicator position 0..1 */
  value: number
  zones?: Zone[]
  className?: string
}

export function ZoneBar({ value, zones = DEFAULT_ZONES, className = '' }: ZoneBarProps) {
  const clamped = Math.max(0, Math.min(1, value))
  return (
    <div className={`relative h-5 ${className}`}>
      <div className="absolute inset-x-0 top-2 flex gap-[1.5px] rounded-md overflow-hidden h-1">
        {zones.map((z, i) => (
          <div key={i} className="opacity-65" style={{ flex: z.size, background: z.color }} />
        ))}
      </div>
      <div
        className="absolute top-0 h-5 w-[3px] rounded-sm bg-white"
        style={{
          left: `${clamped * 100}%`,
          transform: 'translateX(-50%)',
          boxShadow: '0 0 12px rgba(255,255,255,0.6)',
        }}
      />
    </div>
  )
}
