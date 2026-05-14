'use client'

import { motion } from 'motion/react'
import { pageControl } from '@/lib/motion-presets'

export interface PageControlProps {
  count: number
  /** 0-indexed active dot index */
  active: number
  className?: string
}

export function PageControl({ count, active, className = '' }: PageControlProps) {
  return (
    <div
      className={`flex items-center gap-1.5 ${className}`}
      role="tablist"
      aria-label="Page indicator"
    >
      {Array.from({ length: count }, (_, i) => {
        const isActive = i === active
        return (
          <motion.span
            key={i}
            data-active={isActive}
            role="tab"
            aria-selected={isActive}
            className={[
              'block w-1.5 h-1.5 rounded-full',
              isActive ? 'bg-text-primary' : 'bg-text-muted',
            ].join(' ')}
            variants={pageControl}
            animate={isActive ? 'active' : 'inactive'}
            initial={false}
          />
        )
      })}
    </div>
  )
}
