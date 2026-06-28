import { describe, expect, it } from 'vitest'
import {
  MAX_FEEDBACK_LENGTH,
  SaveSessionFeedbackSchema,
} from '@/lib/training/session-feedback-contract'

// A valid RFC 4122 v4 UUID (version nibble 4, variant nibble 8) — the shape
// Postgres' gen_random_uuid() produces and Zod v4's .uuid() requires.
const UUID = '11111111-1111-4111-8111-111111111111'

describe('SaveSessionFeedbackSchema', () => {
  it('accepts a feedback note', () => {
    const r = SaveSessionFeedbackSchema.safeParse({
      session_type: 'gym',
      session_id: UUID,
      feedback_text: 'Voelde sterk vandaag',
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.dismissed).toBe(false)
  })

  it('accepts a pure dismissal with no text', () => {
    const r = SaveSessionFeedbackSchema.safeParse({
      session_type: 'run',
      session_id: UUID,
      dismissed: true,
    })
    expect(r.success).toBe(true)
  })

  it('rejects an empty, non-dismissed request (would desync the nudge)', () => {
    const r = SaveSessionFeedbackSchema.safeParse({
      session_type: 'padel',
      session_id: UUID,
      feedback_text: '   ',
    })
    expect(r.success).toBe(false)
  })

  it('rejects a non-training session type', () => {
    const r = SaveSessionFeedbackSchema.safeParse({
      session_type: 'walk',
      session_id: UUID,
      feedback_text: 'nope',
    })
    expect(r.success).toBe(false)
  })

  it('rejects a non-uuid session id', () => {
    const r = SaveSessionFeedbackSchema.safeParse({
      session_type: 'gym',
      session_id: 'not-a-uuid',
      feedback_text: 'hi',
    })
    expect(r.success).toBe(false)
  })

  it('rejects feedback over the length cap', () => {
    const r = SaveSessionFeedbackSchema.safeParse({
      session_type: 'gym',
      session_id: UUID,
      feedback_text: 'x'.repeat(MAX_FEEDBACK_LENGTH + 1),
    })
    expect(r.success).toBe(false)
  })
})
