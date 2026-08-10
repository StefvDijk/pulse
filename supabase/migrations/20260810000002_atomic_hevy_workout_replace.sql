-- Replace a Hevy workout and its complete exercise/set graph in one
-- transaction. The transaction-scoped advisory lock remains held for the
-- entire destructive replace, unlike a standalone lock RPC.

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
  exercise_row_id uuid;
  exercise_payload jsonb;
  set_payload jsonb;
  best_weight numeric;
  best_reps integer;
  previous_record numeric;
BEGIN
  IF jsonb_typeof(p_workout) <> 'object'
    OR jsonb_typeof(p_exercises) <> 'array' THEN
    RAISE EXCEPTION 'Invalid atomic Hevy workout payload';
  END IF;

  IF p_workout->>'user_id' IS DISTINCT FROM p_user_id::text
    OR p_workout->>'hevy_workout_id' IS DISTINCT FROM p_hevy_workout_id THEN
    RAISE EXCEPTION 'Hevy workout identity does not match RPC arguments';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || p_hevy_workout_id, 0)
  );

  INSERT INTO public.workouts (
    user_id,
    hevy_workout_id,
    title,
    started_at,
    ended_at,
    duration_seconds,
    notes,
    source,
    total_volume_kg,
    set_count,
    exercise_count
  )
  VALUES (
    p_user_id,
    p_hevy_workout_id,
    p_workout->>'title',
    (p_workout->>'started_at')::timestamptz,
    (p_workout->>'ended_at')::timestamptz,
    (p_workout->>'duration_seconds')::integer,
    p_workout->>'notes',
    COALESCE(p_workout->>'source', 'hevy'),
    COALESCE((p_workout->>'total_volume_kg')::numeric, 0),
    COALESCE((p_workout->>'set_count')::integer, 0),
    COALESCE((p_workout->>'exercise_count')::integer, 0)
  )
  ON CONFLICT (user_id, hevy_workout_id) DO UPDATE
  SET
    title = EXCLUDED.title,
    started_at = EXCLUDED.started_at,
    ended_at = EXCLUDED.ended_at,
    duration_seconds = EXCLUDED.duration_seconds,
    notes = EXCLUDED.notes,
    source = EXCLUDED.source,
    total_volume_kg = EXCLUDED.total_volume_kg,
    set_count = EXCLUDED.set_count,
    exercise_count = EXCLUDED.exercise_count
  RETURNING id INTO workout_row_id;

  DELETE FROM public.workout_exercises
  WHERE workout_id = workout_row_id;

  -- Recompute strength PR rows for an edited/re-delivered workout instead of
  -- leaving stale records tied to the previous version of its sets.
  DELETE FROM public.personal_records
  WHERE workout_id = workout_row_id
    AND record_category = 'strength'
    AND record_type = 'weight';

  FOR exercise_payload IN
    SELECT value FROM jsonb_array_elements(p_exercises)
  LOOP
    INSERT INTO public.workout_exercises (
      workout_id,
      exercise_definition_id,
      exercise_order,
      notes
    )
    VALUES (
      workout_row_id,
      (exercise_payload->>'exercise_definition_id')::uuid,
      (exercise_payload->>'exercise_order')::integer,
      exercise_payload->>'notes'
    )
    RETURNING id INTO exercise_row_id;

    FOR set_payload IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(exercise_payload->'sets', '[]'::jsonb))
    LOOP
      INSERT INTO public.workout_sets (
        workout_exercise_id,
        set_order,
        set_type,
        weight_kg,
        reps,
        distance_meters,
        duration_seconds,
        rpe
      )
      VALUES (
        exercise_row_id,
        (set_payload->>'set_order')::integer,
        COALESCE(set_payload->>'set_type', 'normal'),
        (set_payload->>'weight_kg')::numeric,
        (set_payload->>'reps')::integer,
        (set_payload->>'distance_meters')::numeric,
        (set_payload->>'duration_seconds')::integer,
        (set_payload->>'rpe')::numeric
      );
    END LOOP;

    SELECT
      (candidate->>'weight_kg')::numeric,
      (candidate->>'reps')::integer
    INTO best_weight, best_reps
    FROM jsonb_array_elements(COALESCE(exercise_payload->'sets', '[]'::jsonb)) AS candidate
    WHERE COALESCE(candidate->>'set_type', 'normal') <> 'warmup'
      AND (candidate->>'weight_kg')::numeric > 0
    ORDER BY
      (candidate->>'weight_kg')::numeric DESC,
      COALESCE((candidate->>'reps')::integer, 0) DESC
    LIMIT 1;

    IF best_weight IS NOT NULL THEN
      SELECT max(value)
      INTO previous_record
      FROM public.personal_records
      WHERE user_id = p_user_id
        AND exercise_definition_id = (exercise_payload->>'exercise_definition_id')::uuid
        AND record_type = 'weight';

      IF previous_record IS NULL OR best_weight > previous_record THEN
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
          (exercise_payload->>'exercise_definition_id')::uuid,
          'weight',
          'strength',
          best_weight,
          best_reps,
          'kg',
          (p_workout->>'started_at')::timestamptz,
          workout_row_id,
          previous_record
        );
      END IF;
    END IF;

    best_weight := NULL;
    best_reps := NULL;
    previous_record := NULL;
  END LOOP;

  UPDATE public.workouts
  SET pr_count = (
    SELECT count(*)::integer
    FROM public.personal_records
    WHERE workout_id = workout_row_id
      AND record_category = 'strength'
      AND record_type = 'weight'
  )
  WHERE id = workout_row_id;

  RETURN workout_row_id;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_hevy_workout_atomic(uuid, text, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_hevy_workout_atomic(uuid, text, jsonb, jsonb)
  TO service_role;
