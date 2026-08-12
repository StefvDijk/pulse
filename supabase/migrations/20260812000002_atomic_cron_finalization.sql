-- Finalize the observable run row and fairness cursor in one transaction.
CREATE OR REPLACE FUNCTION public.finalize_cron_run(
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
  p_first_error text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_status NOT IN ('success', 'partial', 'error') THEN
    RAISE EXCEPTION 'Invalid terminal cron status';
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
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_cron_run(
  uuid, text, uuid, text, text, integer, integer, integer, boolean, jsonb, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_cron_run(
  uuid, text, uuid, text, text, integer, integer, integer, boolean, jsonb, text
) TO service_role;
