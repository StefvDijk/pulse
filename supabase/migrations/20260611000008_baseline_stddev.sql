-- Audit #15 (readiness v2): z-scores against the athlete's own 30-day
-- baseline need a spread, not just an average. Sample stddev over the same
-- 30d window; NULL when fewer than 2 samples.

ALTER TABLE metric_baselines
  ADD COLUMN IF NOT EXISTS value_30d_stddev numeric;

COMMENT ON COLUMN metric_baselines.value_30d_stddev IS 'Sample stddev over the 30d window; NULL when < 2 samples';
