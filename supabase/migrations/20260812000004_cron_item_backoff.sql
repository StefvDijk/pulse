-- Track poison items independently from the fairness cursor. Failures back off
-- exponentially and are dead-lettered after five attempts, so one bad user or
-- belief cannot consume capacity forever.
CREATE TABLE public.cron_item_failures (
  job_name text NOT NULL,
  item_key text NOT NULL,
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts > 0),
  last_error text,
  first_failed_at timestamptz NOT NULL DEFAULT now(),
  last_failed_at timestamptz NOT NULL DEFAULT now(),
  next_retry_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  dead_lettered_at timestamptz,
  PRIMARY KEY (job_name, item_key)
);

CREATE INDEX cron_item_failures_retry_idx
  ON public.cron_item_failures(job_name, next_retry_at)
  WHERE dead_lettered_at IS NULL;

ALTER TABLE public.cron_item_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cron_item_failures_service_role_all"
  ON public.cron_item_failures FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP FUNCTION public.finalize_cron_run(
  uuid, text, uuid, text, text, integer, integer, integer, boolean, jsonb, text
);

CREATE FUNCTION public.finalize_cron_run(
  p_run_id uuid,
  p_job_name text,
  p_lease_token uuid,
  p_next_cursor text,
  p_status text,
  p_http_status integer,
  p_processed integer,
  p_error_count integer,
  p_truncated boolean,
  p_summary jsonb,
  p_first_error text,
  p_item_outcomes jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  outcome jsonb;
  outcome_key text;
  outcome_error text;
BEGIN
  IF p_status NOT IN ('success', 'partial', 'error') THEN
    RAISE EXCEPTION 'Invalid terminal cron status';
  END IF;
  IF jsonb_typeof(COALESCE(p_item_outcomes, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Cron item outcomes must be an array';
  END IF;

  UPDATE public.cron_runs
  SET status = p_status,
      processed = GREATEST(p_processed, 0),
      error_count = GREATEST(p_error_count, 0),
      truncated = p_truncated,
      http_status = p_http_status,
      finished_at = now(),
      summary = COALESCE(p_summary, '{}'::jsonb),
      first_error = left(p_first_error, 1000)
  WHERE id = p_run_id AND job_name = p_job_name AND status = 'running';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cron run is missing or already finalized';
  END IF;

  UPDATE public.cron_job_state
  SET cursor = p_next_cursor,
      lease_token = NULL,
      lease_expires_at = NULL,
      updated_at = now()
  WHERE job_name = p_job_name AND lease_token = p_lease_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cron lease is missing or no longer owned';
  END IF;

  FOR outcome IN SELECT value FROM jsonb_array_elements(COALESCE(p_item_outcomes, '[]'::jsonb))
  LOOP
    outcome_key := NULLIF(outcome->>'itemKey', '');
    IF outcome_key IS NULL THEN
      RAISE EXCEPTION 'Cron item outcome is missing itemKey';
    END IF;

    IF outcome->>'ok' = 'true' THEN
      DELETE FROM public.cron_item_failures
      WHERE job_name = p_job_name AND item_key = outcome_key;
    ELSE
      outcome_error := left(COALESCE(outcome->>'error', 'Unknown item failure'), 1000);
      INSERT INTO public.cron_item_failures(
        job_name, item_key, attempts, last_error, next_retry_at
      ) VALUES (
        p_job_name, outcome_key, 1, outcome_error, now() + interval '5 minutes'
      )
      ON CONFLICT (job_name, item_key) DO UPDATE
      SET attempts = cron_item_failures.attempts + 1,
          last_error = EXCLUDED.last_error,
          last_failed_at = now(),
          next_retry_at = now() + make_interval(
            mins => LEAST((power(2, cron_item_failures.attempts)::integer * 5), 1440)
          ),
          dead_lettered_at = CASE
            WHEN cron_item_failures.attempts + 1 >= 5
              THEN COALESCE(cron_item_failures.dead_lettered_at, now())
            ELSE NULL
          END;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_cron_run(
  uuid, text, uuid, text, text, integer, integer, integer, boolean, jsonb, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_cron_run(
  uuid, text, uuid, text, text, integer, integer, integer, boolean, jsonb, text, jsonb
) TO service_role;
