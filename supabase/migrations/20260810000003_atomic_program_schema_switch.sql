-- Insert the candidate schema and switch active schemas in one transaction.
-- A failure in either phase rolls back both, so no orphan candidate remains.

CREATE OR REPLACE FUNCTION public.insert_and_activate_training_schema(
  p_user_id uuid,
  p_schema jsonb,
  p_previous_schema_id uuid DEFAULT NULL,
  p_previous_end_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_schema_id uuid;
BEGIN
  IF jsonb_typeof(p_schema) <> 'object'
    OR p_schema->>'user_id' IS DISTINCT FROM p_user_id::text THEN
    RAISE EXCEPTION 'Training schema identity does not match RPC user';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  INSERT INTO public.training_schemas (
    user_id,
    title,
    schema_type,
    weeks_planned,
    start_date,
    workout_schedule,
    progression_rules,
    quality_audit,
    planned_weekly_load,
    source_block_review_id,
    is_active,
    ai_generated,
    generation_context
  )
  VALUES (
    p_user_id,
    p_schema->>'title',
    p_schema->>'schema_type',
    COALESCE((p_schema->>'weeks_planned')::integer, 4),
    (p_schema->>'start_date')::date,
    p_schema->'workout_schedule',
    COALESCE(p_schema->'progression_rules', '{}'::jsonb),
    COALESCE(p_schema->'quality_audit', '{}'::jsonb),
    COALESCE(p_schema->'planned_weekly_load', '{}'::jsonb),
    (p_schema->>'source_block_review_id')::uuid,
    false,
    COALESCE((p_schema->>'ai_generated')::boolean, true),
    p_schema->>'generation_context'
  )
  RETURNING id INTO new_schema_id;

  PERFORM public.activate_training_schema(
    p_user_id,
    new_schema_id,
    p_previous_schema_id,
    p_previous_end_date
  );

  RETURN new_schema_id;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_and_activate_training_schema(uuid, jsonb, uuid, date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_and_activate_training_schema(uuid, jsonb, uuid, date)
  TO service_role;
