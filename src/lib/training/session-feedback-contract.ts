import { z } from 'zod'
import { SESSION_FEEDBACK_TYPES } from './session-feedback'

// ---------------------------------------------------------------------------
// Wire contract for POST /api/sessions/feedback.
//
// One request both saves feedback and dismisses: the user either provides
// `feedback_text` (a note) or sets `dismissed: true` ("niets toe te voegen").
// At least one of the two must be meaningful — an empty, non-dismissed request
// is a no-op we reject so the nudge state can't silently desync.
// ---------------------------------------------------------------------------

export const MAX_FEEDBACK_LENGTH = 1000

export const SaveSessionFeedbackSchema = z
  .object({
    session_type: z.enum(SESSION_FEEDBACK_TYPES),
    session_id: z.string().uuid(),
    feedback_text: z
      .string()
      .trim()
      .max(MAX_FEEDBACK_LENGTH)
      .nullable()
      .optional(),
    dismissed: z.boolean().optional().default(false),
  })
  .refine(
    (v) => v.dismissed || (v.feedback_text != null && v.feedback_text.length > 0),
    { message: 'Geef feedback of markeer de sessie als overgeslagen', path: ['feedback_text'] },
  )

export type SaveSessionFeedbackInput = z.infer<typeof SaveSessionFeedbackSchema>
