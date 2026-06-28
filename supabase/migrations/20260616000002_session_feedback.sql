-- Migration: session_feedback — optional free-text feedback per training session
-- (gym | run | padel). Surfaced as a home nudge after a session is imported, and
-- fed into the weekly review so qualitative context (skipped an exercise, how it
-- felt, a niggle) reaches the coach. A row also marks the session as "handled"
-- (feedback given OR dismissed) so the nudge stops asking.
--
-- session_id is polymorphic (points at workouts | runs | padel_sessions depending
-- on session_type) so it cannot carry a foreign key. session_title and
-- session_started_at are denormalised snapshots taken at save time so the weekly
-- review can render the entry without a three-way join and survives session edits.

CREATE TABLE IF NOT EXISTS public.session_feedback (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_type       TEXT NOT NULL CHECK (session_type IN ('gym', 'run', 'padel')),
  session_id         UUID NOT NULL,
  session_title      TEXT,
  session_started_at TIMESTAMPTZ NOT NULL,
  feedback_text      TEXT,
  dismissed          BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, session_type, session_id)
);

CREATE INDEX IF NOT EXISTS session_feedback_user_started_idx
  ON public.session_feedback (user_id, session_started_at DESC);

COMMENT ON TABLE public.session_feedback IS 'Optional per-session user feedback (gym|run|padel); doubles as the seen/handled ledger for the home feedback nudge';
COMMENT ON COLUMN public.session_feedback.session_id IS 'Polymorphic id into workouts|runs|padel_sessions depending on session_type';
COMMENT ON COLUMN public.session_feedback.feedback_text IS 'Free-text note; null when the user dismissed without commenting';
COMMENT ON COLUMN public.session_feedback.dismissed IS 'true when the user explicitly skipped giving feedback for this session';

CREATE TRIGGER update_session_feedback_updated_at
  BEFORE UPDATE ON public.session_feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.session_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own session_feedback" ON public.session_feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users write own session_feedback" ON public.session_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own session_feedback" ON public.session_feedback
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access session_feedback" ON public.session_feedback
  FOR ALL TO service_role USING (true) WITH CHECK (true);
