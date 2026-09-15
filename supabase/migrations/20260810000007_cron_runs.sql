-- Durable status for scheduled jobs. Platform HTTP status remains the alerting
-- signal; these rows preserve per-run evidence for diagnosis and dashboards.

CREATE TABLE public.cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'success', 'partial', 'error')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  http_status integer CHECK (http_status BETWEEN 100 AND 599),
  processed integer NOT NULL DEFAULT 0 CHECK (processed >= 0),
  error_count integer NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  truncated boolean NOT NULL DEFAULT false,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_error text
);

CREATE INDEX cron_runs_job_started_idx
  ON public.cron_runs(job_name, started_at DESC);

ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cron_runs_service_role_all"
  ON public.cron_runs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.cron_runs IS
  'Durable status of Vercel cron executions; stale running rows indicate interrupted invocations.';
