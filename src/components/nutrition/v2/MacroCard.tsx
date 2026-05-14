/**
 * MacroCard — v2 macro donut + macro rows + calorie footer card.
 * Composes existing MacroSummary/ProteinTracker inside the v2 card shell.
 * Matches the "Macros donut" card in Nutrition (screens/Other.jsx).
 */
import { MacroSummary, type MacroSummaryProps } from '@/components/nutrition/MacroSummary'
import { ProteinTracker } from '@/components/nutrition/ProteinTracker'

export interface MacroCardProps extends MacroSummaryProps {
  calorieTarget: number | null
  proteinTarget: number | null
  burnedCalories?: number
}

export function MacroCard({
  calories,
  protein_g,
  carbs_g,
  fat_g,
  fiber_g,
  calorieTarget,
  proteinTarget,
  burnedCalories = 0,
}: MacroCardProps) {
  const netCalories = calories - burnedCalories

  return (
    <div className="rounded-[22px] bg-bg-surface border-[0.5px] border-bg-border p-[18px]">
      <MacroSummary
        calories={calories}
        protein_g={protein_g}
        carbs_g={carbs_g}
        fat_g={fat_g}
        fiber_g={fiber_g}
      />

      {proteinTarget && (
        <div className="mt-3">
          <ProteinTracker current={protein_g} target={proteinTarget} />
        </div>
      )}

      {calorieTarget && (
        <div
          className="mt-3.5 pt-3.5 flex justify-between tabular-nums"
          style={{ borderTop: '0.5px solid var(--color-bg-border)' }}
        >
          <div>
            <span className="block text-[11px] text-text-tertiary">Calorieën</span>
            <span className="text-[22px] font-bold text-text-primary">
              {calories}{' '}
              <span className="text-[13px] font-normal text-text-tertiary">/ {calorieTarget}</span>
            </span>
          </div>
          {burnedCalories > 0 && (
            <div>
              <span className="block text-[11px] text-text-tertiary">Verbrand</span>
              <span className="text-[22px] font-bold text-text-primary">{burnedCalories}</span>
            </div>
          )}
          {burnedCalories > 0 && (
            <div>
              <span className="block text-[11px] text-text-tertiary">Netto</span>
              <span
                className="text-[22px] font-bold"
                style={{ color: 'var(--color-status-good)' }}
              >
                {netCalories}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
