import type { CSSProperties, ReactNode } from 'react'

type Radius = 'sm' | 'md' | 'lg' | 'xl'

const RADIUS: Record<Radius, string> = {
  sm: 'rounded-[10px]',
  md: 'rounded-[16px]',
  lg: 'rounded-[22px]',
  xl: 'rounded-[28px]',
}

export interface CardProps {
  children: ReactNode
  radius?: Radius
  className?: string
  style?: CSSProperties
  /** Glow color for outer halo (e.g. sport accent rgba). */
  glow?: string
}

export function Card({ children, radius = 'lg', className = '', style, glow }: CardProps) {
  return (
    <div
      className={`relative overflow-hidden border-[0.5px] border-bg-border bg-bg-surface ${RADIUS[radius]} ${className}`}
      style={{
        boxShadow: glow ? `0 0 48px -12px ${glow}` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function GlassCard({ children, radius = 'lg', className = '', style }: Omit<CardProps, 'glow'>) {
  return (
    <div
      className={`relative overflow-hidden border-[0.5px] border-bg-border-strong bg-bg-glass backdrop-blur-xl backdrop-saturate-[140%] ${RADIUS[radius]} ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}
