-- [F3] + [G4] — Sprint 2 Group F.
--
-- F3: indexes that the workout-detail and search hot paths rely on.
-- G4: auth trigger that auto-creates the user_settings row on signup
--     (avoids .single() crashes for fresh accounts).
--
-- Idempotent: re-runnable.

-- -------------------------------------------------------------------------
-- F3.1 — workout_exercises join key
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_workout_exercises_exercise_def
  ON public.workout_exercises (exercise_definition_id);

-- -------------------------------------------------------------------------
-- F3.2 — personal_records lookup by workout
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_personal_records_workout
  ON public.personal_records (workout_id);

-- -------------------------------------------------------------------------
-- F3.3 — trigram index for ILIKE-style title search
--
-- Skip in environments where the user lacks superuser to install pg_trgm;
-- in that case the ilike scan stays linear (fine for ~200 workouts).
-- -------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm') THEN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE INDEX IF NOT EXISTS idx_workouts_title_trgm
      ON public.workouts USING gin (title gin_trgm_ops);
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- G4 — auto-create user_settings row when a new auth user signs up.
-- Without this, the first request after signup crashes on .single().
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -------------------------------------------------------------------------
-- Rollback (manual; uncomment to revert):
--
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP FUNCTION IF EXISTS public.handle_new_user();
-- DROP INDEX IF EXISTS public.idx_workouts_title_trgm;
-- DROP INDEX IF EXISTS public.idx_personal_records_workout;
-- DROP INDEX IF EXISTS public.idx_workout_exercises_exercise_def;
-- -------------------------------------------------------------------------
