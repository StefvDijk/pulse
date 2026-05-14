import { ButtonHTMLAttributes, forwardRef } from 'react'

export type ButtonVariant = 'filled' | 'tinted' | 'glass' | 'plain' | 'destructive'
export type ButtonSize = 'sm' | 'md' | 'lg'
export type ButtonSport = 'gym' | 'run' | 'padel' | 'cycle' | 'neutral'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Affects tinted/destructive accent colour. Default: 'neutral' */
  sport?: ButtonSport
  fullWidth?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  filled:
    'bg-text-primary text-bg-page font-semibold hover:opacity-90 active:scale-[0.98]',
  tinted:
    'font-semibold active:scale-[0.98]',
  glass:
    'glass-menu text-text-primary font-medium active:scale-[0.98]',
  plain:
    'text-text-primary font-medium hover:text-text-secondary active:scale-[0.98]',
  destructive:
    'bg-status-bad text-text-primary font-semibold active:scale-[0.98]',
}

/** Tinted variant — sport-specific token overrides */
const tintedSportClasses: Record<ButtonSport, string> = {
  neutral: 'bg-text-primary/10 text-text-primary',
  gym:     'bg-sport-gym-light text-sport-gym-base',
  run:     'bg-sport-run-light text-sport-run-base',
  padel:   'bg-sport-padel-light text-sport-padel-base',
  cycle:   'bg-sport-cycle-light text-sport-cycle-base',
}

const sizeClasses: Record<ButtonSize, { base: string; radius: string }> = {
  sm: { base: 'min-h-[36px] px-3 text-body-s', radius: 'rounded-full' },
  md: { base: 'min-h-[44px] px-4 text-body',   radius: 'rounded-full' },
  lg: { base: 'min-h-[50px] px-5 text-body-l', radius: 'rounded-card-md' },
}

const baseClasses = [
  'inline-flex items-center justify-center gap-2',
  'transition-all duration-150',
  'disabled:opacity-50 disabled:pointer-events-none',
  'focus:outline-none focus-visible:ring-1 focus-visible:ring-text-primary/30',
].join(' ')

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'filled',
    size = 'md',
    sport = 'neutral',
    fullWidth = false,
    className = '',
    type = 'button',
    children,
    ...props
  },
  ref,
) {
  const { base: sizeBase, radius } = sizeClasses[size]

  const variantCss =
    variant === 'tinted'
      ? `${variantClasses.tinted} ${tintedSportClasses[sport]}`
      : variantClasses[variant]

  const composed = [
    baseClasses,
    variantCss,
    sizeBase,
    radius,
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button ref={ref} type={type} className={composed} {...props}>
      {children}
    </button>
  )
})
