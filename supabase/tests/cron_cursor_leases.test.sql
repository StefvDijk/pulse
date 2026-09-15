BEGIN;
SELECT plan(5);

SELECT is(
  public.claim_cron_job('test-cursor', 60)->>'cursor',
  NULL,
  'a new cron job starts without a cursor'
);

SELECT throws_ok(
  $$ SELECT public.claim_cron_job('test-cursor', 60) $$,
  '55P03',
  'Cron job test-cursor already has an active lease',
  'an overlapping invocation cannot claim the same job'
);

SELECT lives_ok(
  $$
    SELECT public.finish_cron_job(
      'test-cursor',
      (SELECT lease_token FROM public.cron_job_state WHERE job_name = 'test-cursor'),
      'user-20'
    )
  $$,
  'the lease owner can persist its next keyset cursor'
);

SELECT is(
  public.claim_cron_job('test-cursor', 60)->>'cursor',
  'user-20',
  'the next invocation resumes after the saved cursor'
);

SELECT throws_ok(
  $$
    SELECT public.finish_cron_job(
      'test-cursor',
      '70000000-0000-0000-0000-000000000001',
      NULL
    )
  $$,
  'P0001',
  'Cron lease is missing or no longer owned',
  'a stale invocation cannot overwrite the current cursor'
);

SELECT * FROM finish();
ROLLBACK;
