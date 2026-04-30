'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { NutritionInput } from './NutritionInput'
import { MacroSummary } from './MacroSummary'
import { ProteinTracker } from './ProteinTracker'
import { DayIndicator } from './DayIndicator'
import { MealsList } from './MealsList'
import { SkeletonCard, SkeletonRect, SkeletonLine } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import type { NutritionSummaryData } from '@/app/api/nutrition/summary/route'
import { addDaysToKey, daysAgoAmsterdam, todayAmsterdam } from '@/lib/time/amsterdam'

async function fetcher(url: string): Promise<NutritionSummaryData> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Laden mislukt')
  return res.json()
}

function formatDateLabel(dateStr: string): string {
  const today = todayAmsterdam()
  const yesterday = daysAgoAmsterdam(1)

  if (dateStr === today) return 'Vandaag'
  if (dateStr === yesterday) return 'Gisteren'
  return new Date(dateStr).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' })
}

function offsetDate(dateStr: string, days: number): string {
  return addDaysToKey(dateStr, days)
}

export function NutritionPage() {
  const [selectedDate, setSelectedDate] = useState(() => todayAmsterdam())
  const today = todayAmsterdam()

  const { data, error, isLoading, mutate } = useSWR<NutritionSummaryData>(
    `/api/nutrition/summary?date=${selectedDate}`,
    fetcher,
    { revalidateOnFocus: true },
  )

  const handleSuccess = useCallback(() => {
    mutate()
  }, [mutate])

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/nutrition/log/${id}`, { method: 'DELETE' })
        mutate()
      } catch {
        // Ignore — optimistic UI handled by mutate
      }
    },
    [mutate],
  )

  const summary = data?.summary
  const meals = data?.logs ?? []

  const calorieTarget = summary?.calorie_target ?? null
  const proteinTarget = summary?.protein_target_g ?? null
  const totalCalories = summary?.total_calories ?? 0
  const totalProtein = summary?.total_protein_g ?? 0
  const totalCarbs = summary?.total_carbs_g ?? 0
  const totalFat = summary?.total_fat_g ?? 0
  const totalFiber = summary?.total_fiber_g ?? 0

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Date navigation */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-label-primary">
          Voeding
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedDate((d) => offsetDate(d, -1))}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-label-tertiary hover:opacity-70"
            aria-label="Vorige dag"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-label-primary">
            {formatDateLabel(selectedDate)}
          </span>
          <button
            onClick={() => setSelectedDate((d) => offsetDate(d, 1))}
            disabled={selectedDate >= today}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-label-tertiary disabled:opacity-20 hover:opacity-70"
            aria-label="Volgende dag"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Input */}
      <NutritionInput onSuccess={handleSuccess} date={selectedDate} />

      {error && <ErrorAlert message="Kan voedingsdata niet laden." onRetry={() => mutate()} />}

      {isLoading && <NutritionSkeleton />}

      {!isLoading && (
        <>
          {/* Day status */}
          <DayIndicator
            calories={totalCalories}
            calorieTarget={calorieTarget}
            protein={totalProtein}
            proteinTarget={proteinTarget}
          />

          {/* Macro summary + protein tracker */}
          {totalCalories > 0 && (
            <div className="flex flex-col gap-4 bg-surface-primary border border-separator rounded-[14px] p-4">
              <MacroSummary
                calories={totalCalories}
                protein_g={totalProtein}
                carbs_g={totalCarbs}
                fat_g={totalFat}
                fiber_g={totalFiber}
              />
              {proteinTarget && (
                <ProteinTracker current={totalProtein} target={proteinTarget} />
              )}
            </div>
          )}

          {/* Meals list */}
          <div className="bg-surface-primary border border-separator rounded-[14px] p-4">
            <h2 className="mb-3 text-[17px] font-semibold text-label-primary">
              Maaltijden
            </h2>
            <MealsList meals={meals} onDelete={handleDelete} />
          </div>
        </>
      )}
    </div>
  )
}

function NutritionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonCard className="flex flex-col gap-3">
        <div className="flex justify-center">
          <div className="h-28 w-28 rounded-full bg-system-gray6" />
        </div>
        <SkeletonRect height="h-4" />
      </SkeletonCard>
      <SkeletonCard className="flex flex-col gap-2">
        <SkeletonLine width="w-1/4" />
        {[1,2,3].map(i => <SkeletonRect key={i} height="h-10" />)}
      </SkeletonCard>
    </div>
  )
}
