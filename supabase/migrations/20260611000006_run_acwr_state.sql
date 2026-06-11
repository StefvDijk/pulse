-- Audit #11: persist the running-chain EWMA state, not just the ratio.
-- Readers that need the ACWR "as of date X" decay the last persisted state
-- forward over rest days; that requires acute+chronic for the running chain
-- exactly like the combined chain.

ALTER TABLE daily_aggregations
  ADD COLUMN IF NOT EXISTS run_acwr_acute numeric,
  ADD COLUMN IF NOT EXISTS run_acwr_chronic numeric;

COMMENT ON COLUMN daily_aggregations.run_acwr_acute IS 'EWMA (lambda 2/8) of km/day, all-history chain';
COMMENT ON COLUMN daily_aggregations.run_acwr_chronic IS 'EWMA (lambda 2/29) of km/day, all-history chain';
