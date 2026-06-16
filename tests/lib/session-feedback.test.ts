import { describe, expect, it } from 'vitest'
import {
  SESSION_FEEDBACK_TYPES,
  computePendingSessions,
  feedbackKey,
  formatSessionFeedbackLines,
  isSessionFeedbackType,
  type RecentSession,
  type SessionFeedbackEntry,
} from '@/lib/training/session-feedback'

function session(over: Partial<RecentSession> & Pick<RecentSession, 'session_id' | 'started_at'>): RecentSession {
  return {
    session_type: 'gym',
    title: 'Push A',
    subtitle: null,
    exercises: [],
    ...over,
  }
}

describe('feedbackKey', () => {
  it('is stable and type-scoped', () => {
    expect(feedbackKey('gym', 'abc')).toBe('gym:abc')
    expect(feedbackKey('run', 'abc')).not.toBe(feedbackKey('gym', 'abc'))
  })
})

describe('isSessionFeedbackType', () => {
  it('accepts the three training types and rejects walks/garbage', () => {
    for (const t of SESSION_FEEDBACK_TYPES) expect(isSessionFeedbackType(t)).toBe(true)
    expect(isSessionFeedbackType('walk')).toBe(false)
    expect(isSessionFeedbackType('nonsense')).toBe(false)
  })
})

describe('computePendingSessions', () => {
  it('drops sessions the user already handled (feedback OR dismissed)', () => {
    const recent = [
      session({ session_id: 'a', started_at: '2026-06-15T10:00:00Z' }),
      session({ session_id: 'b', started_at: '2026-06-14T10:00:00Z', session_type: 'run', title: 'Easy run' }),
    ]
    const handled = new Set([feedbackKey('gym', 'a')])
    const pending = computePendingSessions(recent, handled)
    expect(pending.map((p) => p.session_id)).toEqual(['b'])
  })

  it('does not confuse ids across session types', () => {
    const recent = [session({ session_id: 'shared', started_at: '2026-06-15T10:00:00Z', session_type: 'padel', title: 'Padel' })]
    // A gym row with the same id is handled — the padel session must stay pending.
    const handled = new Set([feedbackKey('gym', 'shared')])
    expect(computePendingSessions(recent, handled)).toHaveLength(1)
  })

  it('returns newest first', () => {
    const recent = [
      session({ session_id: 'old', started_at: '2026-06-10T10:00:00Z' }),
      session({ session_id: 'new', started_at: '2026-06-15T10:00:00Z' }),
      session({ session_id: 'mid', started_at: '2026-06-12T10:00:00Z' }),
    ]
    expect(computePendingSessions(recent, new Set()).map((p) => p.session_id)).toEqual(['new', 'mid', 'old'])
  })

  it('caps the queue length', () => {
    const recent = Array.from({ length: 15 }, (_, i) =>
      session({ session_id: `s${i}`, started_at: `2026-06-${String(i + 1).padStart(2, '0')}T10:00:00Z` }),
    )
    expect(computePendingSessions(recent, new Set(), 5)).toHaveLength(5)
  })
})

describe('formatSessionFeedbackLines', () => {
  const base: SessionFeedbackEntry = {
    session_type: 'gym',
    session_started_at: '2026-06-11T18:00:00Z',
    session_title: 'Push A',
    feedback_text: 'Lat pulldown overgeslagen, elleboog gevoelig.',
  }

  it('renders a labelled, dated, quoted bullet', () => {
    const [line] = formatSessionFeedbackLines([base])
    expect(line).toContain('[gym]')
    expect(line).toContain('Push A')
    expect(line).toContain('"Lat pulldown overgeslagen, elleboog gevoelig."')
  })

  it('collapses whitespace and trims', () => {
    const [line] = formatSessionFeedbackLines([{ ...base, feedback_text: '  voelde \n\n  sterk  ' }])
    expect(line).toContain('"voelde sterk"')
  })

  it('falls back to the type label when the title is missing', () => {
    const [line] = formatSessionFeedbackLines([{ ...base, session_type: 'run', session_title: null }])
    expect(line).toContain('[run] ')
    expect(line).toContain('run:')
  })

  it('drops entries with empty feedback', () => {
    expect(formatSessionFeedbackLines([{ ...base, feedback_text: '   ' }])).toHaveLength(0)
  })
})
