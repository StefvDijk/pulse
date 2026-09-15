-- Serialize every Hevy graph replacement for one user and rebuild the complete
-- chronological strength-PR chain before the transaction commits. This fixes
-- edits to older workouts and concurrent replacements of different workouts.

ALTER FUNCTION public.replace_hevy_workout_atomic(uuid, text, jsonb, jsonb)
  RENAME TO replace_hevy_workout_graph_locked;

REVOKE ALL ON FUNCTION public.replace_hevy_workout_graph_locked(uuid, text, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.recompute_user_strength_prs(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  definition_id uuid;
  candidate record;
  running_record numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('hevy-workouts:' || p_user_id::text, 0)
  );

  DELETE FROM public.personal_records
  WHERE user_id = p_user_id
    AND workout_id IS NOT NULL
    AND record_category = 'strength'
    AND record_type = 'weight';

  UPDATE public.workouts
  SET pr_count = 0
  WHERE user_id = p_user_id;

  FOR definition_id IN
    SELECT DISTINCT we.exercise_definition_id
    FROM public.workout_exercises we
    JOIN public.workouts w ON w.id = we.workout_id
    WHERE w.user_id = p_user_id
    ORDER BY we.exercise_definition_id
  LOOP
    running_record := NULL;

    FOR candidate IN
      SELECT
        w.id AS workout_id,
        w.started_at,
        best.weight_kg,
        best.reps
      FROM public.workouts w
      JOIN public.workout_exercises we ON we.workout_id = w.id
      CROSS JOIN LATERAL (
        SELECT ws.weight_kg, ws.reps
        FROM public.workout_sets ws
        WHERE ws.workout_exercise_id = we.id
          AND ws.set_type <> 'warmup'
          AND ws.weight_kg > 0
        ORDER BY ws.weight_kg DESC, COALESCE(ws.reps, 0) DESC
        LIMIT 1
      ) best
      WHERE w.user_id = p_user_id
        AND we.exercise_definition_id = definition_id
      ORDER BY w.started_at, w.id
    LOOP
      IF running_record IS NULL OR candidate.weight_kg > running_record THEN
        INSERT INTO public.personal_records (
          user_id,
          exercise_definition_id,
          record_type,
          record_category,
          value,
          reps,
          unit,
          achieved_at,
          workout_id,
          previous_record
        )
        VALUES (
          p_user_id,
          definition_id,
          'weight',
          'strength',
          candidate.weight_kg,
          candidate.reps,
          'kg',
          candidate.started_at,
          candidate.workout_id,
          running_record
        );
        running_record := candidate.weight_kg;
      END IF;
    END LOOP;
  END LOOP;

  UPDATE public.workouts w
  SET pr_count = (
    SELECT count(*)::integer
    FROM public.personal_records pr
    WHERE pr.workout_id = w.id
      AND pr.record_category = 'strength'
      AND pr.record_type = 'weight'
  )
  WHERE w.user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_user_strength_prs(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.replace_hevy_workout_atomic(
  p_user_id uuid,
  p_hevy_workout_id text,
  p_workout jsonb,
  p_exercises jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  workout_row_id uuid;
BEGIN
  -- A user-level key serializes different workouts that can affect the same
  -- exercise PR timeline. It remains held through graph replacement + rebuild.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('hevy-workouts:' || p_user_id::text, 0)
  );

  workout_row_id := public.replace_hevy_workout_graph_locked(
    p_user_id,
    p_hevy_workout_id,
    p_workout,
    p_exercises
  );

  PERFORM public.recompute_user_strength_prs(p_user_id);
  RETURN workout_row_id;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_hevy_workout_atomic(uuid, text, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_hevy_workout_atomic(uuid, text, jsonb, jsonb)
  TO service_role;
