-- Migration: Extend body_composition_logs for Apple Health integration
-- Adds 'apple_health' and 'weekly_checkin' to allowed sources,
-- plus lean_body_mass_kg and bmr_kcal columns for richer InBody data via HealthKit.

-- 1. Drop the old restrictive CHECK constraint and add expanded one
ALTER TABLE body_composition_logs DROP CONSTRAINT IF EXISTS body_composition_logs_source_check;
ALTER TABLE body_composition_logs
  ADD CONSTRAINT body_composition_logs_source_check
  CHECK (source IN ('inbody', 'manual', 'smart_scale', 'apple_health', 'weekly_checkin'));

-- 2. Add new columns for data available via Apple Health / InBody
ALTER TABLE body_composition_logs
  ADD COLUMN IF NOT EXISTS lean_body_mass_kg NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS bmr_kcal NUMERIC(6,1);

COMMENT ON COLUMN body_composition_logs.lean_body_mass_kg IS 'Lean body mass (weight minus fat). From Apple Health HKQuantityTypeIdentifierLeanBodyMass.';
COMMENT ON COLUMN body_composition_logs.bmr_kcal IS 'Basal metabolic rate in kcal/day. From Apple Health HKQuantityTypeIdentifierBasalEnergyBurned.';
