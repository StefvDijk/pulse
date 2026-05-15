-- Migration: Strava integration — OAuth token storage on user_settings
-- and a raw activities cache. Activities sync separately into `runs` etc.
-- via lib code so dedup logic lives in one place.

-- ---------------------------------------------------------------------------
-- 1. OAuth tokens on user_settings (mirrors google_calendar_* pattern)
-- ---------------------------------------------------------------------------

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS strava_access_token TEXT,
  ADD COLUMN IF NOT EXISTS strava_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS strava_token_expiry TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS strava_athlete_id BIGINT,
  ADD COLUMN IF NOT EXISTS strava_athlete_name TEXT;

COMMENT ON COLUMN user_settings.strava_access_token IS 'Strava OAuth access token (short-lived, ~6h). Refreshed via strava_refresh_token.';
COMMENT ON COLUMN user_settings.strava_refresh_token IS 'Strava OAuth refresh token (long-lived). Used to obtain new access tokens.';
COMMENT ON COLUMN user_settings.strava_athlete_id IS 'Strava athlete id — the connected athlete (single-user app: one per Pulse user).';

-- ---------------------------------------------------------------------------
-- 2. Raw activity cache from Strava API
-- ---------------------------------------------------------------------------
-- Stored verbatim so we can re-derive runs/cycling without re-fetching, and
-- keep the polyline available for the map hero (UXR-220). Dedup with Apple
-- Health imports happens in the sync layer when populating `runs`.

CREATE TABLE strava_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strava_activity_id BIGINT NOT NULL,
  athlete_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  activity_type TEXT NOT NULL, -- 'Run', 'Ride', 'Walk', 'Hike', 'VirtualRide', ...
  sport_type TEXT, -- newer Strava field, e.g. 'TrailRun'
  start_date TIMESTAMPTZ NOT NULL,
  start_date_local TIMESTAMPTZ,
  timezone TEXT,
  distance_meters NUMERIC,
  moving_time_seconds INTEGER,
  elapsed_time_seconds INTEGER,
  total_elevation_gain_meters NUMERIC,
  average_speed_mps NUMERIC,
  max_speed_mps NUMERIC,
  average_heartrate NUMERIC,
  max_heartrate NUMERIC,
  average_cadence NUMERIC,
  calories NUMERIC,
  -- Encoded polyline (Google polyline algorithm) — decode with @mapbox/polyline
  -- or maplibre's helper to plot the route. Summary polyline is lower-res, used
  -- for thumbnails; the full polyline ships only in /activities/{id} details.
  summary_polyline TEXT,
  detailed_polyline TEXT,
  start_lat NUMERIC,
  start_lng NUMERIC,
  end_lat NUMERIC,
  end_lng NUMERIC,
  -- Full raw payload kept for debugging + future fields we don't model yet.
  raw_payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  details_fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, strava_activity_id)
);

CREATE INDEX idx_strava_activities_user_start
  ON strava_activities(user_id, start_date DESC);
CREATE INDEX idx_strava_activities_type
  ON strava_activities(user_id, activity_type, start_date DESC);

ALTER TABLE strava_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own strava activities"
  ON strava_activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own strava activities"
  ON strava_activities FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to strava activities"
  ON strava_activities FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE strava_activities IS 'Raw Strava activity cache (UXR-220). Sync layer derives `runs` etc. from this.';
COMMENT ON COLUMN strava_activities.summary_polyline IS 'Low-res encoded polyline from /athlete/activities list endpoint.';
COMMENT ON COLUMN strava_activities.detailed_polyline IS 'High-res encoded polyline from /activities/{id} detail endpoint.';

-- ---------------------------------------------------------------------------
-- 3. Optional: link a `runs` row to the Strava activity that produced it
-- ---------------------------------------------------------------------------
-- Soft-link: we don't FK to strava_activities because runs may also be sourced
-- from Apple Health. Storing the strava_activity_id lets us update a run from
-- Strava without losing health metrics merged from another source.

ALTER TABLE runs
  ADD COLUMN IF NOT EXISTS strava_activity_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_runs_strava_activity
  ON runs(user_id, strava_activity_id)
  WHERE strava_activity_id IS NOT NULL;

COMMENT ON COLUMN runs.strava_activity_id IS 'Strava activity id when this run was sourced from / enriched by Strava.';
