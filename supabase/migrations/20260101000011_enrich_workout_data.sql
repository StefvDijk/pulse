-- Migration: enrich workout data + add hevy_routines, sleep_logs, body_weight_logs
-- This enables the full "digital sport twin" data model:
--   Hevy workouts enriched with computed stats + PR detection
--   Apple Health sleep/weight correlation
--   Hevy routines stored for schema comparison

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Enrich workouts table with computed stats + biometrics from Apple Watch
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS total_volume_kg   NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS set_count         INT,
  ADD COLUMN IF NOT EXISTS exercise_count    INT,
  ADD COLUMN IF NOT EXISTS pr_count          INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_heart_rate    INT,
  ADD COLUMN IF NOT EXISTS max_heart_rate    INT,
  ADD COLUMN IF NOT EXISTS calories_burned   INT;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Add category to exercise_definitions
--    Values: strength | cardio | plyometrics | olympic_weightlifting |
--            powerlifting | stretching | other
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE exercise_definitions
  ADD COLUMN IF NOT EXISTS category TEXT;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Hevy routines (training programs stored in Hevy)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hevy_routines (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hevy_routine_id   TEXT        NOT NULL,
  title             TEXT        NOT NULL,
  folder_id         TEXT,
  updated_at_hevy   TIMESTAMPTZ,
  exercises         JSONB       NOT NULL DEFAULT '[]',  -- full exercise+set structure from Hevy
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, hevy_routine_id)
);

ALTER TABLE hevy_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own routines"
  ON hevy_routines FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to hevy_routines"
  ON hevy_routines FOR ALL
  USING (true)
  WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Sleep logs (from Apple Health sleep_analysis metric)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sleep_logs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date                DATE        NOT NULL,              -- the calendar date of the night (sleep start date)
  sleep_start         TIMESTAMPTZ,
  sleep_end           TIMESTAMPTZ,
  total_sleep_minutes INT,                               -- total minutes asleep (excludes awake periods)
  deep_sleep_minutes  INT,
  rem_sleep_minutes   INT,
  light_sleep_minutes INT,
  awake_minutes       INT,
  sleep_efficiency    NUMERIC(5,2),                      -- % of time in bed actually sleeping
  source              TEXT        NOT NULL DEFAULT 'apple_health',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date, source)
);

ALTER TABLE sleep_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sleep logs"
  ON sleep_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to sleep_logs"
  ON sleep_logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. Body weight logs (from Apple Health body_mass metric)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS body_weight_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date        DATE        NOT NULL,
  weight_kg   NUMERIC(5,2) NOT NULL,
  source      TEXT        NOT NULL DEFAULT 'apple_health',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date, source)
);

ALTER TABLE body_weight_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own body weight logs"
  ON body_weight_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to body_weight_logs"
  ON body_weight_logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. Indexes
-- ──────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_hevy_routines_user_id ON hevy_routines(user_id);
CREATE INDEX IF NOT EXISTS idx_sleep_logs_user_date   ON sleep_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_body_weight_user_date  ON body_weight_logs(user_id, date DESC);
