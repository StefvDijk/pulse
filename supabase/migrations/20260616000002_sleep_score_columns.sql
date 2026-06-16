-- Migration: sleep score columns
-- Adds the time-in-bed fields needed for a Pulse-native sleep score.
--
-- sleep_logs already carries sleep_start/sleep_end, the stage minutes
-- (deep/rem/light), awake_minutes and sleep_efficiency (migration
-- 20260101000011) — but the parser never populated them. This adds the only
-- fields still missing for an Apple-style sleep score: the in-bed window, used
-- to compute sleep efficiency (asleep / in-bed) and a future "time to fall
-- asleep" signal.
--
-- No RLS change: sleep_logs already has a `service_role FOR ALL` policy that
-- covers every column, and the SELECT policy is row-scoped (not column-scoped).

ALTER TABLE sleep_logs
  ADD COLUMN IF NOT EXISTS in_bed_start   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS in_bed_end     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS in_bed_minutes INT;

COMMENT ON COLUMN sleep_logs.in_bed_start   IS 'HAE inBedStart — when the user got into bed (UTC)';
COMMENT ON COLUMN sleep_logs.in_bed_end     IS 'HAE inBedEnd — when the user got out of bed (UTC)';
COMMENT ON COLUMN sleep_logs.in_bed_minutes IS 'Minutes between in_bed_start and in_bed_end; denominator for sleep efficiency';
