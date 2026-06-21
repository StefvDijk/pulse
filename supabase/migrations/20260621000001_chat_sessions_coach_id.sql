-- Migration: coach_id scoping on chat sessions
-- Coach-team (slice 1, #36): each chat session belongs to exactly one coach so
-- the specialists have separate conversation threads, while the shared brain
-- (coaching_memory, coach_beliefs, ...) stays global — one memory, many faces.
--
-- Existing sessions predate the coach-team and were all answered by the general
-- chat, which now runs as the `manager` coach — so the NOT NULL DEFAULT
-- backfills them to 'manager' with no data loss. Messages stay un-scoped: a
-- message belongs to a session, and the session already carries the coach.
--
-- No RLS change: chat_sessions already has user-scoped policies that cover every
-- column (not column-scoped).

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS coach_id TEXT NOT NULL DEFAULT 'manager';

COMMENT ON COLUMN chat_sessions.coach_id IS 'Owning coach for this thread (manager|sport|nutrition|health); set at creation, immutable after';

-- Sessions-list query pattern: most-recent threads for one coach of one user.
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_coach
  ON chat_sessions (user_id, coach_id, last_message_at DESC NULLS LAST);
