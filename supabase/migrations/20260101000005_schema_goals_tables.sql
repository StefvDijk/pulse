-- Migration 005: Trainingsschema's, Doelen, Personal Records

-- Trainingsschema's
CREATE TABLE training_schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    schema_type TEXT NOT NULL CHECK (schema_type IN ('upper_lower', 'push_pull_legs', 'full_body', 'custom')),
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    weeks_planned INTEGER DEFAULT 4,
    current_week INTEGER DEFAULT 1,
    progression_rules JSONB DEFAULT '{}',
    workout_schedule JSONB NOT NULL DEFAULT '{"days": []}',
    ai_generated BOOLEAN DEFAULT false,
    generation_context TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schema block samenvattingen (voor context assembler)
CREATE TABLE schema_block_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    schema_id UUID NOT NULL REFERENCES training_schemas(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    exercises_used TEXT[] DEFAULT '{}',
    key_progressions JSONB DEFAULT '{}',
    adherence_percentage DECIMAL(5,1),
    total_sessions_planned INTEGER,
    total_sessions_completed INTEGER,
    end_reason TEXT CHECK (end_reason IN ('completed', 'time_up', 'injury', 'goal_reached', 'switched')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Doelen
CREATE TABLE goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('strength', 'running', 'padel', 'nutrition', 'body_composition', 'general')),
    target_type TEXT NOT NULL CHECK (target_type IN ('numeric', 'boolean', 'habit')),
    target_value DECIMAL(10,2),
    target_unit TEXT,
    current_value DECIMAL(10,2),
    deadline DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Personal Records
CREATE TABLE personal_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    exercise_definition_id UUID REFERENCES exercise_definitions(id),
    record_type TEXT NOT NULL CHECK (record_type IN ('weight', 'reps', 'distance', 'pace', 'duration')),
    record_category TEXT NOT NULL,
    value DECIMAL(10,2) NOT NULL,
    unit TEXT NOT NULL,
    achieved_at TIMESTAMPTZ NOT NULL,
    workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
    run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
    previous_record DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_training_schemas_updated_at
    BEFORE UPDATE ON training_schemas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at
    BEFORE UPDATE ON goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
