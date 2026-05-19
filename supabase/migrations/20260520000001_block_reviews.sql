-- Migration: block_reviews — stores the 8-week block-close snapshot
-- Mirrors the structure of weekly_reviews but for a full training block.

CREATE TABLE block_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    schema_id UUID NOT NULL REFERENCES training_schemas(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
    end_reason TEXT NOT NULL CHECK (end_reason IN ('completed', 'switched', 'injury', 'goal_reached', 'time_up')),

    -- User reflection (Step 3)
    template_ratings JSONB DEFAULT '{}',
    keep_exercises TEXT[] DEFAULT '{}',
    drop_exercises TEXT[] DEFAULT '{}',
    biggest_win TEXT,
    biggest_miss TEXT,
    injury_updates JSONB DEFAULT '{}',

    -- Auto data snapshot (Step 1 + 2)
    performance_snapshot JSONB DEFAULT '{}',
    body_snapshot JSONB DEFAULT '{}',

    -- AI output (Step 4)
    ai_analysis TEXT,
    ai_schema_proposal JSONB,

    -- Result (Step 5)
    next_schema_id UUID REFERENCES training_schemas(id) ON DELETE SET NULL,
    new_goal_ids UUID[] DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);

CREATE INDEX idx_block_reviews_user ON block_reviews(user_id, created_at DESC);
CREATE INDEX idx_block_reviews_schema ON block_reviews(schema_id);

ALTER TABLE block_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "block_reviews_owner_all"
    ON block_reviews FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "block_reviews_service_role_all"
    ON block_reviews FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE block_reviews IS '8-week block close-out: data snapshot + reflection + AI analysis + next block proposal.';
