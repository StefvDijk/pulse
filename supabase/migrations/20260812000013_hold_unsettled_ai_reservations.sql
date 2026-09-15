-- A provider call can be billable even when usage settlement temporarily
-- fails. Keep every unreleased reservation in the current month's spend; a
-- wall-clock expiry must never silently restore budget headroom.
ALTER TABLE public.ai_budget_reservations
  ALTER COLUMN expires_at SET DEFAULT 'infinity'::timestamptz;
UPDATE public.ai_budget_reservations
SET expires_at='infinity'::timestamptz
WHERE released_at IS NULL;
CREATE INDEX ai_budget_reservations_unreleased_month_idx
  ON public.ai_budget_reservations(user_id,created_at)
  WHERE released_at IS NULL;

CREATE OR REPLACE FUNCTION public.reserve_ai_budget(
  p_user_id uuid,
  p_budget_usd numeric,
  p_estimated_cost_usd numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  month_start timestamptz;
  spent numeric;
  reserved numeric;
  reservation_id uuid;
  projected numeric;
BEGIN
  IF p_budget_usd <= 0 OR p_estimated_cost_usd <= 0 THEN
    RAISE EXCEPTION 'AI budget and reservation must be positive';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ai-budget:' || p_user_id::text, 0));
  month_start := date_trunc('month', now() AT TIME ZONE 'Europe/Amsterdam')
    AT TIME ZONE 'Europe/Amsterdam';

  SELECT COALESCE(sum(estimated_cost_usd), 0)
  INTO spent
  FROM public.ai_usage_log
  WHERE user_id = p_user_id
    AND created_at >= month_start;

  SELECT COALESCE(sum(estimated_cost_usd), 0)
  INTO reserved
  FROM public.ai_budget_reservations
  WHERE user_id = p_user_id
    AND released_at IS NULL
    AND created_at >= month_start;

  projected := spent + reserved + p_estimated_cost_usd;
  IF projected > p_budget_usd THEN
    RAISE EXCEPTION 'AI monthly budget exceeded'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.ai_budget_reservations(user_id, estimated_cost_usd)
  VALUES (p_user_id, p_estimated_cost_usd)
  RETURNING id INTO reservation_id;

  RETURN jsonb_build_object(
    'reservation_id', reservation_id,
    'spent_usd', spent,
    'reserved_usd', reserved + p_estimated_cost_usd,
    'budget_usd', p_budget_usd,
    'warning', projected >= p_budget_usd * 0.7
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_budget(uuid,numeric,numeric)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_budget(uuid,numeric,numeric) TO service_role;
