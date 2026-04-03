-- Add image_url column to exercise_definitions for wger exercise images
ALTER TABLE exercise_definitions
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN exercise_definitions.image_url IS 'Exercise illustration URL from wger.de API';
