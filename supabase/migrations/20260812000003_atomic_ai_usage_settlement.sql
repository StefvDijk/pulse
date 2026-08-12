-- Convert a budget reservation into recorded provider spend atomically. If the
-- usage insert fails, the reservation remains active instead of failing open.
CREATE OR REPLACE FUNCTION public.settle_ai_usage(
  p_reservation_id uuid,
  p_user_id uuid,
  p_feature text,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cache_read_tokens integer,
  p_cache_creation_tokens integer,
  p_estimated_cost_usd numeric,
  p_duration_ms integer,
  p_status text,
  p_error_code text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  usage_id uuid;
BEGIN
  PERFORM 1
  FROM public.ai_budget_reservations
  WHERE id = p_reservation_id
    AND user_id = p_user_id
    AND released_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI budget reservation is missing or already settled';
  END IF;

  INSERT INTO public.ai_usage_log(
    user_id, feature, model, input_tokens, output_tokens,
    cache_read_tokens, cache_creation_tokens, estimated_cost_usd,
    duration_ms, status, error_code
  ) VALUES (
    p_user_id, p_feature, p_model, p_input_tokens, p_output_tokens,
    p_cache_read_tokens, p_cache_creation_tokens,
    GREATEST(COALESCE(p_estimated_cost_usd, 0), 0),
    p_duration_ms, p_status, p_error_code
  )
  RETURNING id INTO usage_id;

  UPDATE public.ai_budget_reservations
  SET released_at = now()
  WHERE id = p_reservation_id AND user_id = p_user_id;

  RETURN usage_id;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_ai_usage(
  uuid, uuid, text, text, integer, integer, integer, integer,
  numeric, integer, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_ai_usage(
  uuid, uuid, text, text, integer, integer, integer, integer,
  numeric, integer, text, text
) TO service_role;
