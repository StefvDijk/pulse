-- Migration: coach_inbox — unified inbox for proactive messages + questions

CREATE TABLE coach_inbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('anomaly', 'mid_block', 'morning_readiness', 'belief_question', 'post_workout', 'coach_question')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    requires_response BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'dismissed', 'actioned')),
    related_entity_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_coach_inbox_user_status ON coach_inbox(user_id, status, created_at DESC);

ALTER TABLE coach_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY coach_inbox_select_own ON coach_inbox
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY coach_inbox_modify_own ON coach_inbox
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY coach_inbox_service_role ON coach_inbox
    FOR ALL TO service_role USING (true) WITH CHECK (true);
