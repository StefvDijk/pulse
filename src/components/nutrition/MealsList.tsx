'use client'

import { Trash2 } from 'lucide-react'
import type { Database } from '@/types/database'

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

function formatTime(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

export function MealsList({ meals, onDelete }: MealsListProps) {
  if (meals.length === 0) {
    return (
      <p className="py-4 text-center text-[13px] text-text-tertiary">
        Nog geen maaltijden vandaag
      </p>
    )
  }

  return (
    <div className="flex flex-col">
      {meals.map((meal, index) => (
        <div
          key={meal.id}
          className="flex items-center gap-3 px-4 py-3.5"
          style={
            index > 0
              ? { borderTop: '0.5px solid var(--color-bg-border)' }
              : undefined
          }
        >
          {/* Time column */}
          <div className="w-9 shrink-0 text-[11px] text-text-tertiary tabular-nums font-medium">
            {formatTime(meal.created_at)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold text-text-primary truncate">
              {MEAL_TYPE_LABELS[meal.meal_type ?? ''] ?? meal.meal_type ?? '—'}
            </div>
            <div className="mt-0.5 text-[12px] text-text-secondary truncate">
              {meal.raw_input}
            </div>
          </div>

          {/* Kcal + protein */}
          <div className="shrink-0 text-right">
            <div className="text-[13px] font-bold tabular-nums text-text-primary">
              {meal.estimated_calories ?? 0}
            </div>
            <div className="text-[10px] font-semibold" style={{ color: '#00E5C7' }}>
              {meal.estimated_protein_g ?? 0}g eiwit
            </div>
          </div>

          {/* Delete */}
          <button
            onClick={() => onDelete(meal.id)}
            className="flex h-11 w-11 shrink-0 items-center justify-center text-text-tertiary active:opacity-60"
            aria-label="Verwijder maaltijd"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
    </div>
  )
}
