import { HTMLAttributes, forwardRef } from 'react'

export type GlassPanelRadius = 'none' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
export type GlassPanelKind = 'nav' | 'sheet' | 'menu'

export interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  radius?: GlassPanelRadius
  kind?: GlassPanelKind
}

const radiusClasses: Record<GlassPanelRadius, string> = {
  none: '',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  xl: 'rounded-2xl',
  '2xl': 'rounded-3xl',
  full: 'rounded-full',
}

const kindClasses: Record<GlassPanelKind, string> = {
  nav:   'glass-nav',
  sheet: 'glass-sheet',
  menu:  'glass-menu',
}

/**
 * GlassPanel — backdrop-blur surface using iOS 26 Liquid Glass recipes.
 *
 * Three kinds:
 * - `nav`   (default 72% opacity) — tab bar, sticky nav headers
 * - `sheet` (default 85% opacity) — modals, sheets, popovers
 * - `menu`  (default 92% opacity) — context menus, segmented-control indicators
 *
 * Defaults to `kind="sheet"`. NEVER use for content cards — those are flat
 * `bg-bg-surface` with a hairline border (see `Card.tsx`).
 */
export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  function GlassPanel(
    { kind = 'sheet', radius = 'xl', className = '', children, ...props },
    ref,
  ) {
    const composed = [kindClasses[kind], radiusClasses[radius], className]
      .filter(Boolean)
      .join(' ')

    return (
      <div ref={ref} className={composed} {...props}>
        {children}
      </div>
    )
  },
)
