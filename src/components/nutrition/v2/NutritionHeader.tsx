import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * NutritionHeader — v2 page header for Nutrition.
 * Shows eyebrow label + large title + date-nav chevrons.
 * Matches the header block in Nutrition (screens/Other.jsx).
 */
export interface NutritionHeaderProps {
  eyebrow: string
  title: string
  onPrev: () => void
  onNext: () => void
  nextDisabled: boolean
}

export function NutritionHeader({
  eyebrow,
  title,
  onPrev,
  onNext,
  nextDisabled,
}: NutritionHeaderProps) {
  return (
    <div className="px-4 pt-[64px] pb-3">
      <div className="text-[13px] text-text-tertiary">{eyebrow}</div>
      <div className="mt-1 flex items-center justify-between">
        <h1 className="text-[28px] font-bold tracking-[-0.6px] text-text-primary">{title}</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={onPrev}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-text-secondary active:opacity-60"
            aria-label="Vorige dag"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={onNext}
            disabled={nextDisabled}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-text-secondary disabled:opacity-20 active:opacity-60"
            aria-label="Volgende dag"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
