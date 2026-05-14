import type { ReactNode } from 'react'

export type NavBarVariant = 'inline' | 'large'

export interface NavBarProps {
  leading?: ReactNode
  title?: string
  trailing?: ReactNode
  variant?: NavBarVariant
  className?: string
}

/**
 * NavBar — iOS 26 sticky top navigation header.
 *
 * Uses `glass-nav` (translucent + backdrop-blur) and a hairline border.
 * Two variants:
 * - `inline` (default) — 44pt single row with leading/title/trailing slots
 * - `large` — iOS large-title style; inline row + a second row with a 34px title
 *
 * Always sticky at top with safe-area padding.
 */
export function NavBar({
  leading,
  title,
  trailing,
  variant = 'inline',
  className = '',
}: NavBarProps) {
  const composed = [
    'sticky top-0 z-30 glass-nav pt-safe pl-safe pr-safe',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <header className={composed}>
      <div className="relative flex h-11 items-center px-4">
        <div className="flex min-w-[44px] items-center justify-start">{leading}</div>
        {variant === 'inline' && title && (
          <div className="absolute inset-x-0 flex items-center justify-center pointer-events-none">
            <span className="text-body-l font-semibold text-text-primary truncate max-w-[60vw] pointer-events-auto">
              {title}
            </span>
          </div>
        )}
        <div className="ml-auto flex min-w-[44px] items-center justify-end">{trailing}</div>
      </div>
      {variant === 'large' && title && (
        <div className="px-4 pt-2 pb-3">
          <h1 className="text-display-m font-bold text-text-primary">{title}</h1>
        </div>
      )}
    </header>
  )
}
