/**
 * NaturalLogCard — v2 AI input card with CoachOrb eyebrow.
 * Wraps NutritionInput in the gradient-tinted card shell.
 * Matches the "AI input" block in Nutrition (screens/Other.jsx).
 */
import { CoachOrb } from '@/components/shared/CoachOrb'
import { NutritionInput, type NutritionInputProps } from '@/components/nutrition/NutritionInput'

export interface NaturalLogCardProps {
  onSuccess: NutritionInputProps['onSuccess']
  date: string
}

export function NaturalLogCard({ onSuccess, date }: NaturalLogCardProps) {
  return (
    <div
      className="rounded-[18px] p-3.5"
      style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(0,229,199,0.10))',
        border: '0.5px solid rgba(255,255,255,0.10)',
      }}
    >
      {/* Eyebrow */}
      <div className="mb-2 flex items-center gap-2">
        <CoachOrb size={20} />
        <span
          className="text-[11px] font-semibold uppercase tracking-[1.2px]"
          style={{ color: 'rgba(255,255,255,0.80)' }}
        >
          Log natuurlijk
        </span>
      </div>

      {/* Input field */}
      <NutritionInput onSuccess={onSuccess} date={date} />
    </div>
  )
}
