-- Bounded jobs need a durable keyset cursor; otherwise every invocation keeps
-- selecting the same first page. A lease also prevents overlapping scheduler
-- retries from processing the same page concurrently.

CREATE TABLE public.cron_job_state (
  job_name text PRIMARY KEY,
  cursor text,
  lease_token uuid,
  lease_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cron_job_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cron_job_state_service_role_all"
  ON public.cron_job_state FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.claim_cron_job(
  p_job_name text,
  p_lease_seconds integer DEFAULT 330
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  state public.cron_job_state%ROWTYPE;
  token uuid := gen_random_uuid();
BEGIN
  IF p_lease_seconds < 30 OR p_lease_seconds > 900 THEN
    RAISE EXCEPTION 'Cron lease must be between 30 and 900 seconds';
  END IF;

  INSERT INTO public.cron_job_state(job_name)
  VALUES (p_job_name)
  ON CONFLICT (job_name) DO NOTHING;

  SELECT * INTO state
  FROM public.cron_job_state
  WHERE job_name = p_job_name
  FOR UPDATE;

  IF state.lease_token IS NOT NULL AND state.lease_expires_at > now() THEN
    RAISE EXCEPTION 'Cron job % already has an active lease', p_job_name
      USING ERRCODE = '55P03';
  END IF;

  UPDATE public.cron_job_state
  SET lease_token = token,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      updated_at = now()
  WHERE job_name = p_job_name;

  RETURN jsonb_build_object('lease_token', token, 'cursor', state.cursor);
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_cron_job(
  p_job_name text,
  p_lease_token uuid,
  p_next_cursor text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.cron_job_state
  SET cursor = p_next_cursor,
      lease_token = NULL,
      lease_expires_at = NULL,
      updated_at = now()
  WHERE job_name = p_job_name
    AND lease_token = p_lease_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cron lease is missing or no longer owned';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_cron_job(text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_cron_job(text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.finish_cron_job(text, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_cron_job(text, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.list_nutrition_cron_users(
  p_since date,
  p_after uuid DEFAULT NULL,
  p_limit integer DEFAULT 21
)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT summary.user_id
  FROM public.daily_nutrition_summary summary
  WHERE summary.date >= p_since
    AND (p_after IS NULL OR summary.user_id > p_after)
  ORDER BY summary.user_id
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.list_nutrition_cron_users(date, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_nutrition_cron_users(date, uuid, integer)
  TO service_role;
