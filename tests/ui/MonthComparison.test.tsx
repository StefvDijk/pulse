import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Database } from '@/types/database'
import { MonthComparison } from '@/components/trends/MonthComparison'

type MonthlyRow = Database['public']['Tables']['monthly_aggregations']['Row']

function month(month: number, sessions: number): MonthlyRow {
  return {
    year: 2026,
    month,
    total_sessions: sessions,
    total_training_hours: 10,
    total_tonnage_kg: 1000,
    total_running_km: 20,
    avg_daily_calories: 2200,
    avg_daily_protein_g: 150,
  } as MonthlyRow
}

describe('MonthComparison', () => {
  it('labels the ongoing month as partial and hides misleading full-month deltas', () => {
    render(
      <MonthComparison
        current={month(8, 1)}
        previous={month(7, 20)}
        currentIsPartial
      />,
    )

    expect(screen.getByText(/augustus 2026 · t\/m vandaag/i)).toBeInTheDocument()
    expect(screen.queryByText(/[▲▼]/)).toBeNull()
  })
})
