-- Migration: add reps column to personal_records so we can show
-- "16kg × 8" instead of just "16kg" for weight PRs.
--
-- Existing rows get NULL — they'll be recomputed by the backfill script
-- (scripts/recompute-prs.ts).

ALTER TABLE public.personal_records
  ADD COLUMN IF NOT EXISTS reps INTEGER;

COMMENT ON COLUMN public.personal_records.reps IS
  'For record_type=weight: number of reps in the set where this max weight was achieved';
