-- Migration: Add scheduled_overrides for per-date workout rescheduling
-- When a user moves a workout to a different day, the override is stored here
-- Format: {"2026-04-07": "Upper B", "2026-04-08": null}
-- A date mapped to a focus name means that workout is scheduled there
-- A date mapped to null means that day is forced to be a rest day

ALTER TABLE training_schemas
  ADD COLUMN IF NOT EXISTS scheduled_overrides JSONB DEFAULT '{}';

COMMENT ON COLUMN training_schemas.scheduled_overrides
  IS 'Per-date workout overrides for rescheduling. Maps ISO date string to workout focus name (or null for forced rest).';
