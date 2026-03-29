-- Migration 002: Runs, Padel, Dagelijkse activiteit

-- Hardloopsessies (vanuit Apple Health / Runna sync)
CREATE TABLE runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    apple_health_id TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER NOT NULL,
    distance_meters DECIMAL(8,1) NOT NULL,
    avg_pace_seconds_per_km INTEGER,
    avg_heart_rate INTEGER,
    max_heart_rate INTEGER,
    calories_burned DECIMAL(7,1),
    elevation_gain_meters DECIMAL(6,1),
    run_type TEXT DEFAULT 'easy' CHECK (run_type IN ('easy', 'tempo', 'interval', 'long', 'race')),
    source TEXT NOT NULL DEFAULT 'apple_health' CHECK (source IN ('apple_health', 'manual')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, apple_health_id)
);

-- Padel sessies (vanuit Apple Health)
CREATE TABLE padel_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    apple_health_id TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER NOT NULL,
    avg_heart_rate INTEGER,
    max_heart_rate INTEGER,
    calories_burned DECIMAL(7,1),
    intensity TEXT DEFAULT 'moderate' CHECK (intensity IN ('light', 'moderate', 'high')),
    session_type TEXT DEFAULT 'match' CHECK (session_type IN ('match', 'training', 'drill')),
    source TEXT NOT NULL DEFAULT 'apple_health' CHECK (source IN ('apple_health', 'manual')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, apple_health_id)
);

-- Dagelijkse activiteitsdata (vanuit Apple Health)
CREATE TABLE daily_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    steps INTEGER,
    active_calories DECIMAL(7,1),
    total_calories DECIMAL(7,1),
    active_minutes INTEGER,
    stand_hours INTEGER,
    resting_heart_rate INTEGER,
    hrv_average DECIMAL(5,1),
    source TEXT DEFAULT 'apple_health',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

CREATE TRIGGER update_daily_activity_updated_at
    BEFORE UPDATE ON daily_activity
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
