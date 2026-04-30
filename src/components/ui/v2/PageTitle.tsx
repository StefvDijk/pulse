import type { ReactNode } from 'react'

export interface PageTitleProps {
  children: ReactNode
  sub?: ReactNode
  className?: string
}

export function PageTitle({ children, sub, className = '' }: PageTitleProps) {
  return (
    <div className={`px-4 pt-[6px] pb-[18px] ${className}`}>
      <div className="text-[34px] font-bold tracking-[-0.8px] text-text-primary">{children}</div>
      {sub && <div className="mt-1 text-[13px] text-text-tertiary">{sub}</div>}
    </div>
  )
}

export function BackBar({ label = 'Terug' }: { label?: string }) {
  return (
    <div className="flex items-center gap-1 px-4 pt-[60px] pb-2">
      <svg width="14" height="22" viewBox="0 0 14 22" fill="none" aria-hidden="true">
        <path d="M11 2 L3 11 L11 20" stroke="#0A84FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[17px] tracking-[-0.2px] text-[#0A84FF]">{label}</span>
    </div>
  )
}
