-- Add Google Calendar OAuth token columns to user_settings
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS google_calendar_access_token  text,
  ADD COLUMN IF NOT EXISTS google_calendar_refresh_token text,
  ADD COLUMN IF NOT EXISTS google_calendar_token_expiry  timestamptz,
  ADD COLUMN IF NOT EXISTS google_calendar_email         text;
