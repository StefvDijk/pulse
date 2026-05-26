-- Migration: coach_questions — active inquiry storage
-- Coach uses ask_stef tool to write here; UI surfaces them via coach_inbox.

CREATE TABLE coach_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    urgency TEXT NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'expired', 'dismissed')),
    answer_text TEXT,
    related_belief_id UUID REFERENCES coach_beliefs(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    answered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_coach_questions_user ON coach_questions(user_id, status);
CREATE INDEX idx_coach_questions_expires ON coach_questions(expires_at) WHERE status = 'pending';

ALTER TABLE coach_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY coach_questions_select_own ON coach_questions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY coach_questions_modify_own ON coach_questions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY coach_questions_service_role ON coach_questions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
