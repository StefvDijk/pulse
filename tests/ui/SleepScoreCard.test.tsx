import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { SleepScoreCard } from '@/components/home/SleepScoreCard'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-15T07:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function showSleep(date: string | null, score: number | null = 98) {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({
    date, score, tier: 2, components: [], generatedAt: new Date().toISOString(),
  })))
  return renderCard()
}

function renderCard() {
  return render(<SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
    <SleepScoreCard />
  </SWRConfig>)
}

it('shows the actual historical sleep date instead of calling it last night', async () => {
  showSleep('2026-08-14')
  await screen.findByText('slaapscore')
  expect(screen.queryByText('afgelopen nacht')).toBeNull()
  expect(screen.getByText(/14 augustus 2026/)).toBeVisible()
})

it('shows a failed load and lets the user retry', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(Response.json({ error: 'unavailable' }, { status: 500 }))
    .mockImplementation(async () => Response.json({ date: '2026-09-15', score: 80,
      tier: 2, components: [], generatedAt: new Date().toISOString() })))
  renderCard()
  expect(await screen.findByText('Slaapgegevens konden niet worden geladen.')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Opnieuw proberen' }))
  expect(await screen.findByText('afgelopen nacht')).toBeVisible()
})

it('distinguishes imported but incomplete sleep from no imported sleep', async () => {
  showSleep('2026-08-14', null)
  expect(await screen.findByText(/Onvoldoende slaapgegevens voor een score/)).toBeVisible()
  expect(screen.getByText(/14 augustus 2026/)).toBeVisible()
  expect(screen.queryByText(/Nog geen slaap geïmporteerd/)).toBeNull()
})

it('rejects a malformed score instead of rendering a misleading result', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ date: '2026-09-15',
    score: 'excellent', tier: 2, components: [], generatedAt: new Date().toISOString() })))
  renderCard()
  expect(await screen.findByText('Slaapgegevens konden niet worden geladen.')).toBeVisible()
})

it('uses the Amsterdam date around UTC midnight', async () => {
  vi.setSystemTime(new Date('2026-09-14T22:30:00Z'))
  showSleep('2026-09-15')
  expect(await screen.findByText('afgelopen nacht')).toBeVisible()
})

it('shows the date for yesterday instead of implying it is the latest night', async () => {
  showSleep('2026-09-14')
  expect(await screen.findByText(/14 september 2026/)).toBeVisible()
  expect(screen.queryByText('afgelopen nacht')).toBeNull()
})

it('has a distinct empty state with no invented score', async () => {
  showSleep(null, null)
  expect(await screen.findByText(/Nog geen slaap geïmporteerd/)).toBeVisible()
  expect(screen.queryByText('slaapscore')).toBeNull()
})

it.each(['not-a-date', '2026-02-30'])('rejects invalid sleep dates (%s)', async date => {
  showSleep(date)
  expect(await screen.findByText('Slaapgegevens konden niet worden geladen.')).toBeVisible()
})
