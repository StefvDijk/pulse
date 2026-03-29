-- Migration 004: Chat & Blessure tabellen

-- Chat sessies (groepering van berichten)
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ,
    message_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat berichten
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    message_type TEXT CHECK (message_type IN (
        'general', 'injury_report', 'nutrition_log', 'nutrition_question',
        'schema_request', 'progress_question', 'weekly_review'
    )),
    context_used JSONB,
    tokens_used INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blessure logs
CREATE TABLE injury_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    body_location TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT DEFAULT 'mild' CHECK (severity IN ('mild', 'moderate', 'severe')),
    ai_analysis TEXT,
    ai_recommendations TEXT,
    related_workout_ids UUID[] DEFAULT '{}',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'monitoring', 'resolved')),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_injury_logs_updated_at
    BEFORE UPDATE ON injury_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
