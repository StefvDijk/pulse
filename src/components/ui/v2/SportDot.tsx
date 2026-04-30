export type Sport = 'gym' | 'run' | 'padel' | 'cycle'

export const SPORT_BASE: Record<Sport, string> = {
  gym: '#00E5C7',
  run: '#FF5E3A',
  padel: '#FFB020',
  cycle: '#9CFF4F',
}

export const SPORT_LIGHT: Record<Sport, string> = {
  gym: 'rgba(0,229,199,0.18)',
  run: 'rgba(255,94,58,0.18)',
  padel: 'rgba(255,176,32,0.18)',
  cycle: 'rgba(156,255,79,0.18)',
}

export interface SportDotProps {
  sport: Sport
  size?: number
  glow?: boolean
  className?: string
}

export function SportDot({ sport, size = 8, glow = false, className = '' }: SportDotProps) {
  const color = SPORT_BASE[sport]
  return (
    <span
      aria-hidden="true"
      className={`inline-block rounded-full shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: color,
        boxShadow: glow ? `0 0 12px ${color}` : undefined,
      }}
    />
  )
}
