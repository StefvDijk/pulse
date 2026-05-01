-- Migration: skip_reasons — capture WHY a planned session was skipped
-- (vs. just "no log on this date"). Lets the AI spot patterns over time.

CREATE TABLE IF NOT EXISTS public.skip_reasons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  reason      TEXT NOT NULL CHECK (reason IN ('ziek', 'druk', 'rust', 'anders')),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS skip_reasons_user_date_idx ON public.skip_reasons (user_id, date);

COMMENT ON TABLE public.skip_reasons IS 'User-confirmed skip context per date — feeds pattern analysis in coaching memory';
COMMENT ON COLUMN public.skip_reasons.reason IS 'ziek | druk | rust | anders';

ALTER TABLE public.skip_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own skip_reasons" ON public.skip_reasons
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users write own skip_reasons" ON public.skip_reasons
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own skip_reasons" ON public.skip_reasons
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access" ON public.skip_reasons
  FOR ALL TO service_role USING (true) WITH CHECK (true);
