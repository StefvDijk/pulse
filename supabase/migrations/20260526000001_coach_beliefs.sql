-- Migration: coach_beliefs — procedural memory layer
-- Stores hypotheses the coach holds about Stef (what works, what doesn't).
-- Confidence is recalculated by belief-update.ts from evidence arrays.

CREATE TABLE coach_beliefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    hypothesis_text TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('training', 'nutrition', 'recovery', 'lifestyle', 'preference')),
    evidence_for JSONB NOT NULL DEFAULT '[]'::jsonb,
    evidence_against JSONB NOT NULL DEFAULT '[]'::jsonb,
    confidence NUMERIC(3, 2) NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'confirmed', 'superseded', 'rejected')),
    superseded_by UUID REFERENCES coach_beliefs(id) ON DELETE SET NULL,
    last_tested_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_coach_beliefs_user ON coach_beliefs(user_id, status);
CREATE INDEX idx_coach_beliefs_category ON coach_beliefs(user_id, category) WHERE status = 'active';
CREATE INDEX idx_coach_beliefs_last_tested ON coach_beliefs(last_tested_at) WHERE status = 'active';

CREATE TRIGGER coach_beliefs_updated_at
    BEFORE UPDATE ON coach_beliefs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE coach_beliefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY coach_beliefs_select_own ON coach_beliefs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY coach_beliefs_modify_own ON coach_beliefs
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY coach_beliefs_service_role ON coach_beliefs
    FOR ALL TO service_role USING (true) WITH CHECK (true);
