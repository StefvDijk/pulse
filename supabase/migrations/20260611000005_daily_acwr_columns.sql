-- Audit #11: one canonical ACWR. The EWMA acute/chronic state is persisted
-- per day on daily_aggregations so every reader (workload page, readiness,
-- coach context, check-in, block review, weekly aggregation) reads the same
-- numbers instead of computing its own variant.
--
-- acwr_ratio is NULL while there is no meaningful chronic baseline (build-up
-- phase after a gap) — we never fabricate a 1.0 "optimal".
-- run_acwr_ratio is a running-only ACWR over km/day, the sports-science
-- standard for running volume, so a running spike can't hide inside the
-- combined number.

ALTER TABLE daily_aggregations
  ADD COLUMN IF NOT EXISTS acwr_acute numeric,
  ADD COLUMN IF NOT EXISTS acwr_chronic numeric,
  ADD COLUMN IF NOT EXISTS acwr_ratio numeric,
  ADD COLUMN IF NOT EXISTS run_acwr_ratio numeric;

COMMENT ON COLUMN daily_aggregations.acwr_acute IS 'EWMA (lambda 2/8) of training_load_score, all-history chain';
COMMENT ON COLUMN daily_aggregations.acwr_chronic IS 'EWMA (lambda 2/29) of training_load_score, all-history chain';
COMMENT ON COLUMN daily_aggregations.acwr_ratio IS 'acwr_acute / acwr_chronic; NULL when chronic baseline is insufficient';
COMMENT ON COLUMN daily_aggregations.run_acwr_ratio IS 'Running-only ACWR over km/day; NULL when chronic running baseline is insufficient';
