-- Migration: user_profile — single source of truth for static "who is this user" data
-- that was previously hardcoded in chat-system.ts (sections 2, 3, 5, 9, 10, 11).
--
-- One row per user. Updated infrequently. Read on every AI prompt build.

CREATE TABLE IF NOT EXISTS user_profile (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Basic facts: age, height, location, work, diet, schedule pattern
  basics JSONB,

  -- Recurring habits (commute, fixed sessions): [{label, frequency, days?, notes?}]
  recurring_habits JSONB DEFAULT '[]',

  -- Injuries with rich context: [{location, status, restrictions[], notes}]
  -- Distinct from `injuries` table (incident logs) — this is the long-lived
  -- "what does the AI need to know about this user's body" view.
  injuries JSONB DEFAULT '[]',

  -- Nutrition: {protein_g_per_day, kcal_training, kcal_rest, structure_notes,
  --             supplements[], weak_spots[]}
  nutrition_targets JSONB,

  -- Training-response heuristics / lessons learned: [{lesson, learned_at}]
  training_response JSONB DEFAULT '[]',

  -- Single text field for the gym name + location
  gym_location TEXT,

  -- Optional barometer exercises with baselines: [{exercise, baseline, current?, target?, status?}]
  barometer_exercises JSONB DEFAULT '[]',

  -- Optional body composition baseline notes (free text — historical scans live in body_composition_logs)
  body_composition_notes TEXT,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_profile IS 'Long-lived user facts that shape AI prompts. Edited rarely, read often.';
COMMENT ON COLUMN user_profile.basics IS 'Object: age, height_cm, location, work, diet, schedule_pattern';
COMMENT ON COLUMN user_profile.recurring_habits IS 'Array of {label, frequency, days?, notes?}';
COMMENT ON COLUMN user_profile.injuries IS 'Array of {location, status, restrictions[], notes}';
COMMENT ON COLUMN user_profile.nutrition_targets IS 'Object: protein_g_per_day, kcal_training, kcal_rest, structure_notes, supplements[], weak_spots[]';
COMMENT ON COLUMN user_profile.training_response IS 'Array of {lesson, learned_at} — heuristics confirmed by lived experience';
COMMENT ON COLUMN user_profile.barometer_exercises IS 'Array of {exercise, baseline, current?, target?, status?}';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION user_profile_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_profile_updated_at_trigger ON user_profile;
CREATE TRIGGER user_profile_updated_at_trigger
  BEFORE UPDATE ON user_profile
  FOR EACH ROW
  EXECUTE FUNCTION user_profile_set_updated_at();

-- RLS
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON user_profile;
CREATE POLICY "Users can read own profile" ON user_profile
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profile;
CREATE POLICY "Users can insert own profile" ON user_profile
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profile;
CREATE POLICY "Users can update own profile" ON user_profile
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access" ON user_profile;
CREATE POLICY "Service role full access" ON user_profile
  FOR ALL TO service_role USING (true) WITH CHECK (true);
