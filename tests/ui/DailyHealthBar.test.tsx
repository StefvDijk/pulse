import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { DailyHealthBar } from '@/components/home/DailyHealthBar'

const health = {
  date: '2026-09-15', today: '2026-09-15', isStale: false, lastSyncedAt: null,
  steps: 1500, resting_heart_rate: null, hrv_average: null, active_calories: null,
  total_calories: null, active_minutes: null, stand_hours: null,
  sleep_minutes: 463, sleep_date: '2026-08-14', weight_kg: null, weight_date: null,
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-15T07:00:00Z'))
  vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(
    url === '/api/baselines' ? { baselines: [] } : health,
  )))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

function renderBar() {
  return render(<SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
    <DailyHealthBar />
  </SWRConfig>)
}

it('shows the sleep measurement date even when the activity row is from today', async () => {
  renderBar()
  await screen.findByText('7u 43m')
  expect(screen.getByText('14 aug 2026')).toBeVisible()
})

it.each(['http', 'network'])('shows %s failure and recovers with retry', async kind => {
  let attempts = 0
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/baselines') return Response.json({ baselines: [] })
    if (++attempts === 1) {
      if (kind === 'network') throw new Error('Offline')
      return Response.json({ error: 'unavailable' }, { status: 500 })
    }
    return Response.json(health)
  }))
  renderBar()
  expect(await screen.findByText('Gezondheidsgegevens konden niet worden geladen.')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Opnieuw proberen' }))
  expect(await screen.findByText('7u 43m')).toBeVisible()
})

it('rejects malformed measurements instead of displaying NaN', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(
    url === '/api/baselines' ? { baselines: [] } : { ...health, sleep_minutes: 'unknown' },
  )))
  renderBar()
  expect(await screen.findByText('Gezondheidsgegevens konden niet worden geladen.')).toBeVisible()
})

it('uses the server Amsterdam day even before UTC midnight', async () => {
  vi.setSystemTime(new Date('2026-09-14T22:30:00Z'))
  renderBar()
  await screen.findByText('7u 43m')
  expect(screen.queryByText(/15 sep/)).toBeNull()
  expect(screen.getByText('14 aug 2026')).toBeVisible()
})

it('does not compare historical sleep with today’s baseline', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(
    url === '/api/baselines' ? { baselines: [
      { metric: 'resting_hr', value_30d_avg: 50 },
      { metric: 'sleep_minutes', value_30d_avg: 400 },
    ] } : { ...health, resting_heart_rate: 55 },
  )))
  renderBar()
  await screen.findByLabelText(/vs 30d gemiddelde/)
  expect(screen.getAllByLabelText(/vs 30d gemiddelde/)).toHaveLength(1)
})
