-- Migration: weekly lessons feed for the journal page (UXR-120, UXR-121, UXR-122).
-- AI extracts 1-2 short coaching lessons per week from the user's data and
-- stores them here. The journal page renders these as a chronological feed
-- under the existing coaching_memory.

CREATE TABLE weekly_lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  lesson_text TEXT NOT NULL,
  -- Free-form category — kept loose so the AI extractor can experiment.
  -- Known values match coaching_memory: program / lifestyle / injury /
  -- preference / pattern / goal.
  category TEXT NOT NULL DEFAULT 'pattern',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weekly_lessons_user_week
  ON weekly_lessons(user_id, week_start DESC);

ALTER TABLE weekly_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own weekly lessons"
  ON weekly_lessons FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own weekly lessons"
  ON weekly_lessons FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to weekly lessons"
  ON weekly_lessons FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
