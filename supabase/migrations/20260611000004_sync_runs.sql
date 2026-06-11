-- Migration: sync_runs — one row per sync attempt per source, so the UI can
-- show "last synced X ago" per bron and surface failures (errors were
-- previously invisible). Written fire-and-forget at the end of each sync flow.

CREATE TABLE sync_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('hevy', 'apple_health', 'strava')),
    status TEXT NOT NULL CHECK (status IN ('success', 'error')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    synced_count INTEGER,
    error_count INTEGER,
    first_error TEXT
);

-- Fast lookup of the latest row per (user, source) for the sync-status chips.
CREATE INDEX idx_sync_runs_user_source ON sync_runs(user_id, source, started_at DESC);

ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_runs_owner_select"
    ON sync_runs FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "sync_runs_service_role_all"
    ON sync_runs FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE sync_runs IS 'One row per sync attempt per source (hevy/apple_health/strava). Drives the per-source status chips and makes sync failures visible.';
