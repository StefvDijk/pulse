-- A block review is not confirmed until its successor schema, optional body
-- measurement, summary link and review linkage have all committed together.

DO $$
DECLARE
  duplicate_schemas text;
BEGIN
  SELECT string_agg(schema_id::text, ', ' ORDER BY schema_id::text)
  INTO duplicate_schemas
  FROM (
    SELECT schema_id
    FROM public.block_reviews
    WHERE status IN ('draft', 'confirmed')
    GROUP BY schema_id
    HAVING count(*) > 1
  ) duplicates;

  IF duplicate_schemas IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot enforce one open block review per schema; duplicates for schema ids: %',
      duplicate_schemas;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS block_reviews_one_open_per_schema
  ON public.block_reviews(schema_id)
  WHERE status IN ('draft', 'confirmed');

CREATE OR REPLACE FUNCTION public.finalize_block_review(
  p_user_id uuid,
  p_review_id uuid,
  p_previous_schema_id uuid,
  p_previous_end_date date,
  p_schema jsonb,
  p_body_measurement jsonb DEFAULT NULL,
  p_summary jsonb DEFAULT NULL,
  p_new_goal_ids uuid[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  review_status text;
  existing_schema_id uuid;
  new_schema_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('block-review:' || p_previous_schema_id::text, 0)
  );

  SELECT status, next_schema_id
  INTO review_status, existing_schema_id
  FROM public.block_reviews
  WHERE id = p_review_id
    AND user_id = p_user_id
    AND schema_id = p_previous_schema_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Block review does not belong to user/schema';
  END IF;

  -- A client may retry after the transaction committed but its response was
  -- lost. Return the already-finalized identity without creating duplicates.
  IF review_status = 'confirmed' AND existing_schema_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'review_id', p_review_id,
      'new_schema_id', existing_schema_id,
      'already_confirmed', true
    );
  END IF;

  IF review_status <> 'draft' THEN
    RAISE EXCEPTION 'Block review must be draft before finalization';
  END IF;

  IF (p_schema->>'source_block_review_id')::uuid IS DISTINCT FROM p_review_id THEN
    RAISE EXCEPTION 'Successor schema must reference the block review';
  END IF;

  new_schema_id := public.insert_and_activate_training_schema(
    p_user_id,
    p_schema,
    p_previous_schema_id,
    p_previous_end_date
  );

  IF p_body_measurement IS NOT NULL THEN
    INSERT INTO public.body_composition_logs (
      user_id,
      date,
      weight_kg,
      skeletal_muscle_mass_kg,
      fat_mass_kg,
      fat_pct,
      visceral_fat_level,
      waist_cm,
      source
    )
    VALUES (
      p_user_id,
      (p_body_measurement->>'date')::date,
      (p_body_measurement->>'weight_kg')::numeric,
      (p_body_measurement->>'skeletal_muscle_mass_kg')::numeric,
      (p_body_measurement->>'fat_mass_kg')::numeric,
      (p_body_measurement->>'fat_pct')::numeric,
      (p_body_measurement->>'visceral_fat_level')::numeric,
      (p_body_measurement->>'waist_cm')::numeric,
      'manual'
    );
  END IF;

  IF p_summary IS NOT NULL THEN
    INSERT INTO public.schema_block_summaries (
      user_id,
      schema_id,
      summary,
      exercises_used,
      adherence_percentage,
      total_sessions_planned,
      total_sessions_completed,
      end_reason
    )
    VALUES (
      p_user_id,
      p_previous_schema_id,
      p_summary->>'summary',
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_summary->'exercises_used', '[]'::jsonb))),
      (p_summary->>'adherence_percentage')::numeric,
      (p_summary->>'total_sessions_planned')::integer,
      (p_summary->>'total_sessions_completed')::integer,
      p_summary->>'end_reason'
    );
  END IF;

  UPDATE public.block_reviews
  SET status = 'confirmed',
      confirmed_at = now(),
      next_schema_id = new_schema_id,
      new_goal_ids = COALESCE(p_new_goal_ids, '{}')
  WHERE id = p_review_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Block review finalization update failed';
  END IF;

  RETURN jsonb_build_object(
    'review_id', p_review_id,
    'new_schema_id', new_schema_id,
    'already_confirmed', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_block_review(uuid, uuid, uuid, date, jsonb, jsonb, jsonb, uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_block_review(uuid, uuid, uuid, date, jsonb, jsonb, jsonb, uuid[])
  TO service_role;
