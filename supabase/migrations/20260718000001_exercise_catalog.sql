-- Reference catalog imported from hasaneyldrm/exercises-dataset. Kept SEPARATE
-- from exercise_definitions so the curated muscle-load taxonomy
-- (primary/secondary_muscle_group → heatmap/ACWR) stays authoritative. This is
-- pure reference data (media, instructions, equipment), linked to definitions
-- via exercise_definitions.catalog_id.

CREATE TABLE exercise_catalog (
    id                TEXT PRIMARY KEY,               -- dataset id, e.g. "0001"
    name              TEXT NOT NULL,
    body_part         TEXT NOT NULL,
    equipment         TEXT NOT NULL,
    target            TEXT NOT NULL,
    muscle_group      TEXT NOT NULL,
    secondary_muscles TEXT[] NOT NULL DEFAULT '{}',
    instruction_steps TEXT[] NOT NULL DEFAULT '{}',
    media_id          TEXT,
    image_path        TEXT,
    gif_path          TEXT,
    attribution       TEXT NOT NULL,
    normalized_name   TEXT NOT NULL DEFAULT '',
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_exercise_catalog_normalized ON exercise_catalog(normalized_name);
CREATE INDEX idx_exercise_catalog_body_part ON exercise_catalog(body_part);
CREATE INDEX idx_exercise_catalog_equipment ON exercise_catalog(equipment);
CREATE INDEX idx_exercise_catalog_target ON exercise_catalog(target);

-- Reference data: readable by any authenticated user, writable only by the
-- service role (import script bypasses RLS).
ALTER TABLE exercise_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read exercise catalog"
    ON exercise_catalog FOR SELECT
    TO authenticated
    USING (true);

-- Link curated definitions to their catalog entry (nullable — some definitions
-- will not match).
ALTER TABLE exercise_definitions
    ADD COLUMN IF NOT EXISTS catalog_id TEXT REFERENCES exercise_catalog(id);

-- Public Storage bucket for exercise media (thumbnails + animation GIFs).
INSERT INTO storage.buckets (id, name, public)
VALUES ('exercise-media', 'exercise-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read of exercise media"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'exercise-media');
