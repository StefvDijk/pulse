-- ProgramProposalV2 audit/storage fields for trainer-grade schema generation.

ALTER TABLE training_schemas
  ADD COLUMN IF NOT EXISTS quality_audit JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS planned_weekly_load JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_block_review_id UUID REFERENCES block_reviews(id) ON DELETE SET NULL;

ALTER TABLE block_reviews
  ADD COLUMN IF NOT EXISTS trainer_audit JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS exercise_verdicts JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS missed_sessions JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reverted_at TIMESTAMPTZ;

ALTER TABLE block_reviews
  DROP CONSTRAINT IF EXISTS block_reviews_status_check;

ALTER TABLE block_reviews
  ADD CONSTRAINT block_reviews_status_check
  CHECK (status IN ('draft', 'confirmed', 'reverted'));

CREATE INDEX IF NOT EXISTS idx_training_schemas_source_block_review
  ON training_schemas(source_block_review_id);
