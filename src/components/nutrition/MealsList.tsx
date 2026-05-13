'use client'

import { Trash2 } from 'lucide-react'
import type { Database } from '@/types/database'
import { formatTime } from '@/lib/formatters'

type NutritionLogRow = Database['public']['Tables']['nutrition_logs']['Row']

export interface MealsListProps {
  meals: NutritionLogRow[]
  onDelete: (id: string) => void
}

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Ontbijt',
  lunch: 'Lunch',
  dinner: 'Avondeten',
  snack: 'Snack',
}

export function MealsList({ meals, onDelete }: MealsListProps) {
  if (meals.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-text-tertiary">
        Nog geen maaltijden vandaag
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {meals.map((meal) => (
        <div
          key={meal.id}
          className="flex items-start justify-between gap-3 rounded-lg bg-white/[0.06] p-3"
        >
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs text-text-tertiary">
                {MEAL_TYPE_LABELS[meal.meal_type ?? ''] ?? meal.meal_type ?? '—'}
              </span>
              {meal.created_at && (
                <span className="text-xs text-text-tertiary">
                  {formatTime(meal.created_at)}
                </span>
              )}
            </div>
            <p className="truncate text-sm text-text-primary">
              {meal.raw_input}
            </p>
            <p className="mt-1 text-xs text-text-tertiary">
              {meal.estimated_calories ?? 0} kcal · {meal.estimated_protein_g ?? 0}g eiwit · {meal.estimated_carbs_g ?? 0}g koolh · {meal.estimated_fat_g ?? 0}g vet
            </p>
          </div>

          <button
            onClick={() => onDelete(meal.id)}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center text-text-tertiary transition-opacity hover:text-[var(--color-status-bad)] hover:opacity-70"
            aria-label="Verwijder maaltijd"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
