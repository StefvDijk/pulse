-- Migration: Add extra InBody metrics to body_composition_logs
-- skeletal_muscle_mass_kg: InBody's key metric (skeletal muscle only, excludes organ/bone mass)
-- visceral_fat_level: InBody visceral fat level (1-59 scale, <10 = healthy)
-- body_water_pct: Total body water as percentage

ALTER TABLE body_composition_logs
  ADD COLUMN IF NOT EXISTS skeletal_muscle_mass_kg NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS visceral_fat_level NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS body_water_pct NUMERIC(4,1);

COMMENT ON COLUMN body_composition_logs.skeletal_muscle_mass_kg IS 'Skeletal muscle mass in kg. InBody primary metric — excludes organ/bone mass unlike lean_body_mass.';
COMMENT ON COLUMN body_composition_logs.visceral_fat_level IS 'Visceral fat level (InBody scale 1-59). Below 10 is healthy.';
COMMENT ON COLUMN body_composition_logs.body_water_pct IS 'Total body water as percentage of body weight.';
