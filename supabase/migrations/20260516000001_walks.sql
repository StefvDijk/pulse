-- Walks live in their own table so they do not pollute run-centric
-- calculations (ACWR, weekly pace, AI run-tools). Schema mirrors `runs`
-- minus the run-specific `run_type` column.

CREATE TABLE walks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    apple_health_id TEXT,
    strava_activity_id BIGINT,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER NOT NULL,
    distance_meters DECIMAL(8,1) NOT NULL,
    avg_pace_seconds_per_km INTEGER,
    avg_heart_rate INTEGER,
    max_heart_rate INTEGER,
    calories_burned DECIMAL(7,1),
    elevation_gain_meters DECIMAL(6,1),
    activity_subtype TEXT, -- 'walk' | 'hike' | etc., free text from Strava sport_type
    source TEXT NOT NULL DEFAULT 'apple_health'
      CHECK (source IN ('apple_health', 'manual', 'strava', 'strava+health')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, apple_health_id),
    UNIQUE(user_id, strava_activity_id)
);

CREATE INDEX idx_walks_user_date ON walks(user_id, started_at DESC);
CREATE INDEX idx_walks_strava ON walks(user_id, strava_activity_id)
  WHERE strava_activity_id IS NOT NULL;

ALTER TABLE walks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own walks"
    ON walks FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
