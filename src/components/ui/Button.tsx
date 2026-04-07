import { ButtonHTMLAttributes, forwardRef } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-system-blue text-white font-semibold hover:brightness-110 active:scale-[0.98]',
  secondary:
    'bg-system-blue/10 text-system-blue font-semibold hover:bg-system-blue/15 active:scale-[0.98]',
  ghost:
    'text-system-blue font-medium hover:bg-system-blue/5 active:scale-[0.98]',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-[36px] px-4 text-subhead',
  md: 'min-h-[44px] px-6 text-body',
  lg: 'min-h-[50px] px-8 text-body',
}

const baseClasses = [
  'inline-flex items-center justify-center gap-2',
  'rounded-full',
  'transition-all duration-150',
  'disabled:opacity-50 disabled:pointer-events-none',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-system-blue/40 focus-visible:ring-offset-2',
].join(' ')

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    className = '',
    type = 'button',
    children,
    ...props
  },
  ref,
) {
  const composed = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
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
