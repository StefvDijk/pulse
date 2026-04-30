import { HTMLAttributes } from 'react'

export interface SectionHeaderProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Visuele heading-level voor screen readers (default h2) */
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  /** Optional small action / link aan de rechterkant */
  action?: React.ReactNode
}

const baseClasses = [
  'text-footnote',
  'uppercase',
  'tracking-wider',
  'text-text-secondary',
  'px-4',
  'mb-2',
].join(' ')

/**
 * SectionHeader — iOS Settings-style section header.
 * 13px (footnote), uppercase, letter-spaced, secondary label color.
 */
export function SectionHeader({
  as: Component = 'h2',
  action,
  className = '',
  children,
  ...props
}: SectionHeaderProps) {
  const composed = [baseClasses, action ? 'flex items-end justify-between' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <Component className={composed} {...props}>
      <span>{children}</span>
      {action ? <span className="normal-case tracking-normal">{action}</span> : null}
    </Component>
  )
}
