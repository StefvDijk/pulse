-- Migration: Check-in v2 — wellness scores + previous-week focus outcome
-- Adds subjective wellness ratings and continuity loop fields to weekly_reviews.
-- All nullable; existing rows backfill as NULL.

ALTER TABLE weekly_reviews
  ADD COLUMN IF NOT EXISTS wellness_energy SMALLINT
    CHECK (wellness_energy BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS wellness_motivation SMALLINT
    CHECK (wellness_motivation BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS wellness_stress SMALLINT
    CHECK (wellness_stress BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS notes_text TEXT,
  ADD COLUMN IF NOT EXISTS previous_focus_rating TEXT
    CHECK (previous_focus_rating IN ('gehaald', 'deels', 'niet')),
  ADD COLUMN IF NOT EXISTS previous_focus_note TEXT;

COMMENT ON COLUMN weekly_reviews.wellness_energy IS 'Subjective energy rating 1-5, captured in step 1 of check-in';
COMMENT ON COLUMN weekly_reviews.wellness_motivation IS 'Subjective motivation rating 1-5';
COMMENT ON COLUMN weekly_reviews.wellness_stress IS 'Subjective stress rating 1-5 (higher = more stressed)';
COMMENT ON COLUMN weekly_reviews.notes_text IS 'Free-text answer to "what was the biggest win / what got in the way"';
COMMENT ON COLUMN weekly_reviews.previous_focus_rating IS 'Self-evaluation of last weeks focus_next_week: gehaald | deels | niet';
COMMENT ON COLUMN weekly_reviews.previous_focus_note IS 'Optional 1-line context on the focus outcome';
