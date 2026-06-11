-- Migration: track the last successful Strava sync timestamp.
-- Lives on user_settings next to the Strava OAuth tokens (see
-- 20260515000002_strava.sql) so we can surface "last synced X ago" in the UI
-- and reason about cron freshness. Nullable: null = never synced.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS last_strava_sync_at TIMESTAMPTZ;

COMMENT ON COLUMN user_settings.last_strava_sync_at IS 'Timestamp of the last successful Strava activity sync (manual or cron). Null = never synced.';
