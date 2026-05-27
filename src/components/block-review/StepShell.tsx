'use client'

import { ChevronLeft } from 'lucide-react'

interface StepShellProps {
  title: string
  subtitle?: string
  stepIndex: number
  stepTotal: number
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  children: React.ReactNode
}

export function StepShell({
  title,
  subtitle,
  stepIndex,
  stepTotal,
  onBack,
  onNext,
  nextLabel = 'Volgende',
  nextDisabled,
  children,
}: StepShellProps) {
  return (
    <div className="flex flex-col min-h-dvh bg-bg-base pb-44">
      <div className="sticky top-0 z-10 px-4 pt-[64px] pb-3 bg-bg-base/95 backdrop-blur">
        <div className="flex items-center gap-2 text-[12px] text-text-tertiary">
          {onBack && (
            <button onClick={onBack} aria-label="Terug" className="-ml-1 p-1">
              <ChevronLeft size={18} />
            </button>
          )}
          <span>Stap {stepIndex + 1} / {stepTotal}</span>
        </div>
        <h1 className="mt-1 text-[22px] font-semibold text-text-primary">{title}</h1>
        {subtitle && <p className="text-[13px] text-text-secondary mt-1">{subtitle}</p>}
      </div>

      <div className="flex-1 px-4 flex flex-col gap-4">{children}</div>

      {onNext && (
        <div className="fixed bottom-0 inset-x-0 px-4 pb-6 pt-3 bg-gradient-to-t from-bg-base via-bg-base to-transparent">
          <button
            onClick={onNext}
            disabled={nextDisabled}
            className="w-full h-12 rounded-full text-[15px] font-semibold text-black bg-white disabled:opacity-30"
          >
            {nextLabel}
          </button>
        </div>
      )}
    </div>
  )
}
