// ---------------------------------------------------------------------------
// Session feedback — shared, pure helpers.
//
// Optional free-text feedback the user can leave on an imported training session
// (gym | run | padel). Captured via a home nudge, persisted in `session_feedback`,
// and surfaced back to the coach during the weekly review. Everything here is
// pure (no I/O) so it is trivially unit-testable; the DB/route layers build on it.
// ---------------------------------------------------------------------------

/** The session kinds we ask feedback for. Walks are intentionally excluded. */
export const SESSION_FEEDBACK_TYPES = ['gym', 'run', 'padel'] as const

export type SessionFeedbackType = (typeof SESSION_FEEDBACK_TYPES)[number]

export function isSessionFeedbackType(value: string): value is SessionFeedbackType {
  return (SESSION_FEEDBACK_TYPES as readonly string[]).includes(value)
}

/** Stable key for "this exact session", used to dedupe pending vs. handled. */
export function feedbackKey(type: SessionFeedbackType, sessionId: string): string {
  return `${type}:${sessionId}`
}

/** A recently-imported session that may still need feedback. */
export interface RecentSession {
  session_type: SessionFeedbackType
  session_id: string
  title: string
  started_at: string
  /** One-line context shown under the title (e.g. "6 oefeningen", "8,2 km"). */
  subtitle: string | null
  /** Gym only: exercise names, so the user can reference what they skipped. */
  exercises: string[]
}

/**
 * Sessions still awaiting a response: recent sessions minus the ones the user
 * already handled (gave feedback OR dismissed). Newest first, capped.
 */
export function computePendingSessions(
  recent: RecentSession[],
  handledKeys: ReadonlySet<string>,
  maxItems = 10,
): RecentSession[] {
  return recent
    .filter((s) => !handledKeys.has(feedbackKey(s.session_type, s.session_id)))
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .slice(0, maxItems)
}

// ── Weekly-review rendering ──────────────────────────────────────────────────

/** A saved feedback entry as fed back into the coach's weekly-review context. */
export interface SessionFeedbackEntry {
  session_type: SessionFeedbackType
  session_started_at: string
  session_title: string | null
  feedback_text: string
}

const DATE_FMT = new Intl.DateTimeFormat('nl-NL', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Amsterdam',
})

const TYPE_LABEL: Record<SessionFeedbackType, string> = {
  gym: 'gym',
  run: 'run',
  padel: 'padel',
}

/**
 * Render saved feedback as bullet lines for an AI prompt. Each caller wraps these
 * with its own header. Entries without feedback text (pure dismissals) are
 * dropped by the caller's query, but we guard here too. Returns [] when empty.
 */
export function formatSessionFeedbackLines(entries: SessionFeedbackEntry[]): string[] {
  return entries
    .filter((e) => e.feedback_text && e.feedback_text.trim().length > 0)
    .map((e) => {
      const when = DATE_FMT.format(new Date(e.session_started_at))
      const title = e.session_title?.trim() || TYPE_LABEL[e.session_type]
      const text = e.feedback_text.trim().replace(/\s+/g, ' ')
      return `- [${TYPE_LABEL[e.session_type]}] ${when} · ${title}: "${text}"`
    })
}
