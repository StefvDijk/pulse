'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import { NaturalLogCard, NutritionHeader, MacroCard, MealsCard } from './v2'
import { SkeletonCard, SkeletonRect, SkeletonLine } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import type { NutritionSummaryData } from '@/app/api/nutrition/summary/route'
import { addDaysToKey, daysAgoAmsterdam, todayAmsterdam } from '@/lib/time/amsterdam'

async function fetcher(url: string): Promise<NutritionSummaryData> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Laden mislukt')
  return res.json()
}

function formatPageTitle(dateStr: string): string {
  // Simple on-track title — will be data-driven in a later iteration
  return 'Op koers'
}

function formatEyebrow(dateStr: string): string {
  const today = todayAmsterdam()
  const yesterday = daysAgoAmsterdam(1)

  if (dateStr === today) return 'Voeding · vandaag'
  if (dateStr === yesterday) return 'Voeding · gisteren'
  return `Voeding · ${new Date(dateStr).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' })}`
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
    <div className="flex flex-col pb-24">
      {/* v2 page header with date navigation */}
      <NutritionHeader
        eyebrow={formatEyebrow(selectedDate)}
        title={formatPageTitle(selectedDate)}
        onPrev={() => setSelectedDate((d) => offsetDate(d, -1))}
        onNext={() => setSelectedDate((d) => offsetDate(d, 1))}
        nextDisabled={selectedDate >= today}
      />

      <div className="flex flex-col gap-3 px-4">
        {/* v2 AI input with CoachOrb eyebrow */}
        <NaturalLogCard onSuccess={handleSuccess} date={selectedDate} />

        {error && <ErrorAlert message="Kan voedingsdata niet laden." onRetry={() => mutate()} />}

        {isLoading && <NutritionSkeleton />}

        {!isLoading && (
          <>
            {/* Macro donut + protein tracker + calorie footer */}
            <MacroCard
              calories={totalCalories}
              protein_g={totalProtein}
              carbs_g={totalCarbs}
              fat_g={totalFat}
              fiber_g={totalFiber}
              calorieTarget={calorieTarget}
              proteinTarget={proteinTarget}
            />

            {/* Meals list with v2 time-first row layout */}
            <MealsCard meals={meals} onDelete={handleDelete} />
          </>
        )}
      </div>
    </div>
  )
}

function NutritionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonCard className="flex flex-col gap-3">
        <div className="flex justify-center">
          <div className="h-28 w-28 rounded-full bg-white/[0.06]" />
        </div>
        <SkeletonRect height="h-4" />
      </SkeletonCard>
      <SkeletonCard className="flex flex-col gap-2">
        <SkeletonLine width="w-1/4" />
        {[1, 2, 3].map((i) => (
          <SkeletonRect key={i} height="h-10" />
        ))}
      </SkeletonCard>
    </div>
  )
}
