-- Migration 002: Weekly check-in reviews
-- Stores the result of the weekly check-in flow: coach summary, session stats, manual additions, InBody data.

CREATE TABLE weekly_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,

  -- Review data
  summary_text TEXT,
  sessions_planned INTEGER,
  sessions_completed INTEGER,
  highlights JSONB DEFAULT '[]',
  manual_additions JSONB DEFAULT '[]',

  -- InBody data (optional, captured during check-in)
  inbody_weight_kg NUMERIC(5,2),
  inbody_muscle_mass_kg NUMERIC(5,2),
  inbody_fat_mass_kg NUMERIC(5,2),
  inbody_fat_pct NUMERIC(4,1),
  inbody_waist_cm NUMERIC(5,1),

  -- Planning (v1.1 — placeholder columns for future calendar integration)
  next_week_plan JSONB,
  calendar_synced BOOLEAN DEFAULT FALSE,

  -- Meta
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, week_start)
);

ALTER TABLE weekly_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own reviews"
  ON weekly_reviews FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_weekly_reviews_user_week ON weekly_reviews(user_id, week_start DESC);

CREATE TRIGGER update_weekly_reviews_updated_at
  BEFORE UPDATE ON weekly_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
