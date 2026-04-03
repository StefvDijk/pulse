-- Migration 003: Body composition logs
-- Stores InBody scans and other body measurement entries for historical tracking.

CREATE TABLE body_composition_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  source TEXT DEFAULT 'inbody' CHECK (source IN ('inbody', 'manual', 'smart_scale')),
  weight_kg NUMERIC(5,2),
  muscle_mass_kg NUMERIC(5,2),
  fat_mass_kg NUMERIC(5,2),
  fat_pct NUMERIC(4,1),
  bmi NUMERIC(4,1),
  waist_cm NUMERIC(5,1),
  chest_cm NUMERIC(5,1),
  arm_right_cm NUMERIC(5,1),
  thigh_right_cm NUMERIC(5,1),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, date, source)
);

ALTER TABLE body_composition_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own body comp logs"
  ON body_composition_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_body_comp_user_date ON body_composition_logs(user_id, date DESC);

CREATE TRIGGER update_body_composition_logs_updated_at
  BEFORE UPDATE ON body_composition_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
