-- Resume first-time/recovery Hevy imports across bounded cron invocations.
ALTER TABLE public.user_settings
  ADD COLUMN hevy_full_sync_next_page integer NOT NULL DEFAULT 1
    CHECK (hevy_full_sync_next_page >= 1),
  ADD COLUMN hevy_full_sync_started_at timestamptz;

COMMENT ON COLUMN public.user_settings.hevy_full_sync_next_page IS
  'Next Hevy history page for a bounded full sync; reset to 1 on completion.';
COMMENT ON COLUMN public.user_settings.hevy_full_sync_started_at IS
  'Start watermark preserved across full-sync pages so the later event pass has no gap.';
