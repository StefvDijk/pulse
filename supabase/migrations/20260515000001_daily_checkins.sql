-- Migration: daily_checkins — 30-second mood + sleep quality check-in
-- Used by the homescreen Quick Check-in bottom sheet (UXR-210).
-- One row per user per local day; latest write wins via upsert on (user_id, date).
-- The Sunday/weekly check-in flow keeps writing to weekly_reviews — this table
-- is the daily inputloop that complements it.

CREATE TABLE daily_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  feeling SMALLINT NOT NULL CHECK (feeling BETWEEN 1 AND 5),
  sleep_quality SMALLINT NOT NULL CHECK (sleep_quality BETWEEN 1 AND 5),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX idx_daily_checkins_user_date
  ON daily_checkins(user_id, date DESC);

-- Keep updated_at in sync on upsert. Re-uses the generic helper that exists
-- in the repo (see 20260513143745_indexes_and_user_settings_trigger.sql); if
-- not present we fall back to inlining it here.
CREATE OR REPLACE FUNCTION set_daily_checkins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_daily_checkins_updated_at
  BEFORE UPDATE ON daily_checkins
  FOR EACH ROW
  EXECUTE FUNCTION set_daily_checkins_updated_at();

ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own daily checkins"
  ON daily_checkins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own daily checkins"
  ON daily_checkins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own daily checkins"
  ON daily_checkins FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own daily checkins"
  ON daily_checkins FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to daily checkins"
  ON daily_checkins FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE daily_checkins IS 'Daily 30-sec quick check-in (UXR-210). Complements weekly_reviews.';
COMMENT ON COLUMN daily_checkins.feeling IS 'Subjective overall feeling 1-5 (1=slecht, 5=top)';
COMMENT ON COLUMN daily_checkins.sleep_quality IS 'Subjective sleep quality 1-5 (1=slecht, 5=top)';
COMMENT ON COLUMN daily_checkins.note IS 'Optional free-text note (one line)';
