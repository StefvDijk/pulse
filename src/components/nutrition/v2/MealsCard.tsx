/**
 * MealsCard — v2 meals list card with v2 card shell.
 * Composes existing MealsList inside a rounded surface card.
 * Matches the meals list in Nutrition (screens/Other.jsx).
 */
import { MealsList, type MealsListProps } from '@/components/nutrition/MealsList'

export interface MealsCardProps extends MealsListProps {}

export function MealsCard({ meals, onDelete }: MealsCardProps) {
  return (
    <div className="rounded-[22px] bg-bg-surface border-[0.5px] border-bg-border overflow-hidden">
      <MealsList meals={meals} onDelete={onDelete} />
    </div>
  )
}
