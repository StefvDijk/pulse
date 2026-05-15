-- Allow Strava as a runs source. The derive layer uses 'strava' for runs that
-- arrived only via Strava, and 'strava+health' for runs that were originally
-- imported from Apple Health and later enriched with Strava polyline/pace.

ALTER TABLE runs DROP CONSTRAINT IF EXISTS runs_source_check;

ALTER TABLE runs
  ADD CONSTRAINT runs_source_check
  CHECK (source IN ('apple_health', 'manual', 'strava', 'strava+health'));
