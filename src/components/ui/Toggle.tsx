'use client'

import { motion } from 'motion/react'
import { springInteractive } from '@/lib/motion-presets'

export interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  /** Used as aria-label on the switch button */
  label?: string
}

export function Toggle({ checked, onChange, disabled = false, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative w-[51px] h-[31px] rounded-full',
        'transition-colors duration-200',
        'focus:outline-none focus-visible:ring-1 focus-visible:ring-text-primary/30',
        checked ? 'bg-status-good' : 'bg-text-muted',
        disabled ? 'opacity-50 pointer-events-none' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <motion.span
        className="absolute top-[2px] w-[27px] h-[27px] rounded-full bg-white shadow-sm"
        animate={{ x: checked ? 22 : 2 }}
        transition={springInteractive}
      />
    </button>
  )
}
