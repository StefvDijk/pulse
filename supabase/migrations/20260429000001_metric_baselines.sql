-- Migration: per-user rolling baselines for the metrics we surface in the UI.
-- Goal: every "vs baseline" tag in the app should resolve via a quick lookup
-- here, instead of recomputing windowed averages on every page render.
--
-- Populated nightly by the daily-aggregate cron and on backfill.

CREATE TABLE metric_baselines (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Free-form metric key. Known values:
  --   sleep_minutes, hrv_rmssd, resting_hr, weight_kg, protein_g,
  --   weekly_tonnage_kg, acwr
  metric TEXT NOT NULL,
  date DATE NOT NULL,
  value_30d_avg NUMERIC,
  value_60d_avg NUMERIC,
  value_365d_avg NUMERIC,
  sample_count_30d INTEGER NOT NULL DEFAULT 0,
  sample_count_60d INTEGER NOT NULL DEFAULT 0,
  sample_count_365d INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (user_id, metric, date)
);

-- Fast "latest baseline for metric X" lookups.
CREATE INDEX idx_metric_baselines_user_metric_date
  ON metric_baselines(user_id, metric, date DESC);

ALTER TABLE metric_baselines ENABLE ROW LEVEL SECURITY;

-- User can read their own baselines (UI helper queries).
CREATE POLICY "Users read own baselines"
  ON metric_baselines FOR SELECT
  USING (auth.uid() = user_id);

-- Service role does all writes (cron + backfill).
CREATE POLICY "Service role full access to baselines"
  ON metric_baselines FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
