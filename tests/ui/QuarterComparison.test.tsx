import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '@/types/database'
import { QuarterComparison } from '@/components/trends/QuarterComparison'

type MonthlyRow = Database['public']['Tables']['monthly_aggregations']['Row']

function month(monthNumber: number, sessions: number): MonthlyRow {
  return {
    year: 2026,
    month: monthNumber,
    total_sessions: sessions,
    total_training_hours: 10,
    total_tonnage_kg: 1000,
    total_running_km: 20,
    avg_daily_calories: 2200,
    avg_daily_protein_g: 150,
  } as MonthlyRow
}

describe('QuarterComparison', () => {
  beforeEach(() => vi.setSystemTime(new Date('2026-08-10T12:00:00Z')))
  afterEach(() => vi.useRealTimers())

  it('labels the ongoing quarter as partial and hides full-quarter deltas', () => {
    render(
      <QuarterComparison
        months={[month(4, 10), month(5, 10), month(6, 10), month(7, 2), month(8, 1)]}
        currentIsPartial
      />,
    )

    expect(screen.getByText(/Q3 2026 · t\/m vandaag/i)).toBeInTheDocument()
    expect(screen.queryByText(/[▲▼]/)).toBeNull()
  })
})
