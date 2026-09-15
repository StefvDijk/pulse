-- Store estimated billed cost and atomically reserve headroom before every
-- provider call. Reservations prevent concurrent calls from jointly crossing
-- the configured monthly hard cap.

ALTER TABLE public.ai_usage_log
  ADD COLUMN estimated_cost_usd numeric(12, 6) NOT NULL DEFAULT 0
    CHECK (estimated_cost_usd >= 0);

UPDATE public.ai_usage_log
SET estimated_cost_usd = round((
  COALESCE(input_tokens, 0) * CASE model
    WHEN 'claude-haiku-4-5' THEN 1.0 ELSE 3.0 END
  + COALESCE(output_tokens, 0) * CASE model
    WHEN 'claude-haiku-4-5' THEN 5.0 ELSE 15.0 END
  + COALESCE(cache_read_tokens, 0) * CASE model
    WHEN 'claude-haiku-4-5' THEN 0.1 ELSE 0.3 END
  + COALESCE(cache_creation_tokens, 0) * CASE model
    WHEN 'claude-haiku-4-5' THEN 1.25 ELSE 3.75 END
) / 1000000.0, 6);

CREATE TABLE public.ai_budget_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estimated_cost_usd numeric(12, 6) NOT NULL CHECK (estimated_cost_usd > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '1 hour',
  released_at timestamptz
);

CREATE INDEX ai_budget_reservations_active_idx
  ON public.ai_budget_reservations(user_id, expires_at)
  WHERE released_at IS NULL;

ALTER TABLE public.ai_budget_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_budget_reservations_service_role_all"
  ON public.ai_budget_reservations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

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
    AND expires_at > now();

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

CREATE OR REPLACE FUNCTION public.release_ai_budget_reservation(
  p_user_id uuid,
  p_reservation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.ai_budget_reservations
  SET released_at = now()
  WHERE id = p_reservation_id
    AND user_id = p_user_id
    AND released_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_budget(uuid, numeric, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_budget(uuid, numeric, numeric) TO service_role;
REVOKE ALL ON FUNCTION public.release_ai_budget_reservation(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_ai_budget_reservation(uuid, uuid) TO service_role;
