import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import type { RecentSession } from '@/lib/training/session-feedback'

const state: { pending: RecentSession[] } = { pending: [] }
const refresh = vi.fn()

vi.mock('@/hooks/useSessionFeedback', () => ({
  useSessionFeedback: () => ({ pending: state.pending, isLoading: false, error: undefined, refresh }),
}))

// Import after the mock is registered.
import { SessionFeedbackNudge } from '@/components/home/SessionFeedbackNudge'

const gymSession: RecentSession = {
  session_type: 'gym',
  session_id: 'w1',
  title: 'Push A',
  started_at: '2026-06-15T18:00:00Z',
  subtitle: '6 oefeningen',
  exercises: ['Bench press', 'Incline DB press'],
}

beforeEach(() => {
  state.pending = []
  refresh.mockClear()
})
afterEach(() => cleanup())

describe('SessionFeedbackNudge', () => {
  it('renders nothing when no session is pending', () => {
    const { container } = render(<SessionFeedbackNudge />)
    expect(container.firstChild).toBeNull()
  })

  it('shows a quiet card naming the newest pending session', () => {
    state.pending = [gymSession]
    const { getByText } = render(<SessionFeedbackNudge />)
    expect(getByText('Feedback op je sessie?')).toBeTruthy()
    expect(getByText('Push A')).toBeTruthy()
  })

  it('counts additional pending sessions', () => {
    state.pending = [gymSession, { ...gymSession, session_id: 'w2', title: 'Pull A' }]
    const { getByText } = render(<SessionFeedbackNudge />)
    expect(getByText(/nog 1 sessie/)).toBeTruthy()
  })

  it('opens the feedback sheet with the session context on tap', () => {
    state.pending = [gymSession]
    const { getByLabelText, getByText } = render(<SessionFeedbackNudge />)
    fireEvent.click(getByLabelText('Feedback geven op Push A'))
    // Sheet content is now mounted: the prompt label + an exercise chip for reference.
    expect(getByText('Iets bijzonders deze sessie?')).toBeTruthy()
    expect(getByText('Bench press')).toBeTruthy()
  })
})
