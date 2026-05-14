'use client'

import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

interface CheckInHeaderProps {
  weekNumber: number
  dateRange: string
  step: number
  onBack: (() => void) | null
}

/**
 * CheckInHeader v2 — top nav area for the check-in flow.
 * Uses the back-nav pattern from screens/More.jsx (blue chevron + "Terug").
 * When step === 1, back goes to home via Link; otherwise calls onBack.
 */
export function CheckInHeader({ weekNumber, dateRange, step, onBack }: CheckInHeaderProps) {
  const backEl =
    step > 1 && onBack ? (
      <button
        onClick={onBack}
        className="-ml-1 flex w-fit items-center gap-0.5 text-[#0A84FF] active:opacity-60"
      >
        <ChevronLeft size={22} strokeWidth={2.5} />
        <span className="text-[17px] tracking-[-0.2px]">Terug</span>
      </button>
    ) : (
      <Link
        href="/"
        className="-ml-1 flex w-fit items-center gap-0.5 text-[#0A84FF] active:opacity-60"
      >
        <ChevronLeft size={22} strokeWidth={2.5} />
        <span className="text-[17px] tracking-[-0.2px]">Terug</span>
      </Link>
    )

  return (
    <div className="px-4 pt-[60px] pb-2">
      {backEl}
      <h1 className="mt-2 text-[34px] font-bold tracking-[-0.8px] text-text-primary">
        Check-in
      </h1>
      <p className="mt-1 text-[13px] text-text-tertiary">
        Week {weekNumber} · {dateRange}
      </p>
    </div>
  )
}
