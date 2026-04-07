import { HTMLAttributes, forwardRef } from 'react'

export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding
}

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

const baseClasses = [
  'rounded-2xl',
  'bg-surface-primary',
  'shadow-apple',
  // Dark mode: vervang shadow door subtiele border
  'dark:shadow-none',
  'dark:border',
  'dark:border-white/[0.06]',
].join(' ')

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { padding = 'md', className = '', children, ...props },
  ref,
) {
  const composed = [baseClasses, paddingClasses[padding], className]
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={ref} className={composed} {...props}>
      {children}
    </div>
  )
})
