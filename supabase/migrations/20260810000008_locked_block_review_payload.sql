-- Include mutable review fields in the same lock/transaction as finalization,
-- so two concurrent confirmations cannot mix one request's review with the
-- other request's successor schema.

CREATE OR REPLACE FUNCTION public.finalize_block_review_v2(
  p_user_id uuid,
  p_review_id uuid,
  p_previous_schema_id uuid,
  p_previous_end_date date,
  p_review jsonb,
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
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('block-review:' || p_previous_schema_id::text, 0)
  );

  SELECT status
  INTO review_status
  FROM public.block_reviews
  WHERE id = p_review_id
    AND user_id = p_user_id
    AND schema_id = p_previous_schema_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Block review does not belong to user/schema';
  END IF;

  IF review_status = 'draft' THEN
    UPDATE public.block_reviews
    SET period_start = (p_review->>'period_start')::date,
        period_end = (p_review->>'period_end')::date,
        end_reason = p_review->>'end_reason',
        template_ratings = COALESCE(p_review->'template_ratings', '[]'::jsonb),
        keep_exercises = ARRAY(
          SELECT jsonb_array_elements_text(COALESCE(p_review->'keep_exercises', '[]'::jsonb))
        ),
        drop_exercises = ARRAY(
          SELECT jsonb_array_elements_text(COALESCE(p_review->'drop_exercises', '[]'::jsonb))
        ),
        biggest_win = p_review->>'biggest_win',
        biggest_miss = p_review->>'biggest_miss',
        injury_updates = COALESCE(p_review->'injury_updates', '{}'::jsonb),
        exercise_verdicts = COALESCE(p_review->'exercise_verdicts', '[]'::jsonb),
        missed_sessions = COALESCE(p_review->'missed_sessions', '[]'::jsonb),
        performance_snapshot = COALESCE(p_review->'performance_snapshot', '{}'::jsonb),
        body_snapshot = COALESCE(p_review->'body_snapshot', '{}'::jsonb),
        ai_analysis = p_review->>'ai_analysis',
        ai_schema_proposal = p_review->'ai_schema_proposal',
        trainer_audit = COALESCE(p_review->'trainer_audit', '{}'::jsonb)
    WHERE id = p_review_id
      AND status = 'draft';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Block review draft changed during finalization';
    END IF;
  END IF;

  RETURN public.finalize_block_review(
    p_user_id,
    p_review_id,
    p_previous_schema_id,
    p_previous_end_date,
    p_schema,
    p_body_measurement,
    p_summary,
    p_new_goal_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_block_review(uuid, uuid, uuid, date, jsonb, jsonb, jsonb, uuid[])
  FROM service_role;
REVOKE ALL ON FUNCTION public.finalize_block_review_v2(uuid, uuid, uuid, date, jsonb, jsonb, jsonb, jsonb, uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_block_review_v2(uuid, uuid, uuid, date, jsonb, jsonb, jsonb, jsonb, uuid[])
  TO service_role;
