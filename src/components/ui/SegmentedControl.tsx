'use client'

import { motion } from 'motion/react'
import { springLayout } from '@/lib/motion-presets'

export interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: SegmentedControlProps<T>) {
  // Scope layoutId to this instance to avoid conflicts when multiple
  // SegmentedControls are mounted simultaneously.
  const layoutId = `segmented-indicator-${className || 'default'}`

  return (
    <div
      className={`bg-bg-elevated rounded-full p-1 h-10 flex relative ${className}`}
      role="tablist"
    >
      {options.map((opt) => {
        const isActive = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-pressed={isActive}
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className="relative flex-1 flex items-center justify-center z-10 focus:outline-none"
          >
            {/* Animated background pill for the active segment */}
            {isActive && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-bg-surface"
                transition={springLayout}
              />
            )}
            <span
              className={[
                'relative z-10 text-body-s font-medium select-none',
                isActive ? 'text-text-primary' : 'text-text-secondary',
              ].join(' ')}
            >
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
