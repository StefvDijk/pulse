import { HTMLAttributes, forwardRef } from 'react'

export type GlassPanelRadius = 'none' | 'md' | 'lg' | 'xl' | '2xl' | 'full'

export interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  radius?: GlassPanelRadius
}

const radiusClasses: Record<GlassPanelRadius, string> = {
  none: '',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  xl: 'rounded-2xl',
  '2xl': 'rounded-3xl',
  full: 'rounded-full',
}

/**
 * GlassPanel — backdrop-blur surface met Apple's "vibrancy" effect.
 *
 * Spaarzaam gebruiken: alleen voor tab bar, modals en chat overlay.
 * Niet op gewone cards.
 */
export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  function GlassPanel({ radius = 'xl', className = '', children, ...props }, ref) {
    const composed = ['glass', radiusClasses[radius], className]
      .filter(Boolean)
      .join(' ')

    return (
      <div ref={ref} className={composed} {...props}>
        {children}
      </div>
    )
  },
)
