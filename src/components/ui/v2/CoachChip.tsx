import type { ButtonHTMLAttributes } from 'react'

export interface CoachChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  primary?: boolean
}

export function CoachChip({ primary, className = '', children, ...rest }: CoachChipProps) {
  const base = 'text-[12px] font-medium px-3 py-[7px] rounded-full active:opacity-60 transition'
  const tone = primary
    ? 'bg-white text-black border-none'
    : 'bg-white/[0.08] text-white border-[0.5px] border-white/[0.14]'
  return (
    <button type="button" className={`${base} ${tone} ${className}`} {...rest}>
      {children}
    </button>
  )
}
