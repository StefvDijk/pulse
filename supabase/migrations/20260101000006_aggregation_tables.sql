-- Migration 006: Aggregatie tabellen

-- Dagelijkse aggregatie
CREATE TABLE daily_aggregations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_training_minutes INTEGER DEFAULT 0,
    gym_minutes INTEGER DEFAULT 0,
    running_minutes INTEGER DEFAULT 0,
    padel_minutes INTEGER DEFAULT 0,
    total_sets INTEGER DEFAULT 0,
    total_reps INTEGER DEFAULT 0,
    total_tonnage_kg DECIMAL(10,1) DEFAULT 0,
    total_running_km DECIMAL(6,1) DEFAULT 0,
    muscle_load JSONB DEFAULT '{}',
    movement_pattern_volume JSONB DEFAULT '{}',
    resting_heart_rate INTEGER,
    hrv DECIMAL(5,1),
    training_load_score DECIMAL(5,1),
    is_rest_day BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Wekelijkse aggregatie
CREATE TABLE weekly_aggregations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    week_number INTEGER NOT NULL,
    year INTEGER NOT NULL,
    total_training_minutes INTEGER DEFAULT 0,
    gym_sessions INTEGER DEFAULT 0,
    running_sessions INTEGER DEFAULT 0,
    padel_sessions INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    total_tonnage_kg DECIMAL(10,1) DEFAULT 0,
    total_running_km DECIMAL(6,1) DEFAULT 0,
    weekly_muscle_load JSONB DEFAULT '{}',
    weekly_movement_volume JSONB DEFAULT '{}',
    acute_load DECIMAL(7,1),
    chronic_load DECIMAL(7,1),
    acute_chronic_ratio DECIMAL(4,2),
    workload_status TEXT CHECK (workload_status IN ('low', 'optimal', 'warning', 'danger')),
    planned_sessions INTEGER,
    completed_sessions INTEGER,
    adherence_percentage DECIMAL(5,1),
    avg_resting_heart_rate DECIMAL(4,1),
    avg_hrv DECIMAL(5,1),
    avg_daily_calories DECIMAL(7,1),
    avg_daily_protein_g DECIMAL(5,1),
    week_training_load_total DECIMAL(7,1),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, week_start)
);

-- Maandelijkse aggregatie
CREATE TABLE monthly_aggregations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    total_training_hours DECIMAL(5,1) DEFAULT 0,
    gym_sessions INTEGER DEFAULT 0,
    running_sessions INTEGER DEFAULT 0,
    padel_sessions INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    total_tonnage_kg DECIMAL(12,1) DEFAULT 0,
    total_running_km DECIMAL(7,1) DEFAULT 0,
    strength_highlights JSONB DEFAULT '{}',
    running_highlights JSONB DEFAULT '{}',
    prs_achieved JSONB DEFAULT '[]',
    avg_weekly_sessions DECIMAL(3,1),
    avg_weekly_tonnage DECIMAL(8,1),
    avg_weekly_km DECIMAL(5,1),
    avg_daily_calories DECIMAL(7,1),
    avg_daily_protein_g DECIMAL(5,1),
    injury_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, month, year)
);

CREATE TRIGGER update_daily_aggregations_updated_at
    BEFORE UPDATE ON daily_aggregations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_aggregations_updated_at
    BEFORE UPDATE ON weekly_aggregations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monthly_aggregations_updated_at
    BEFORE UPDATE ON monthly_aggregations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
