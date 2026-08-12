BEGIN;
SELECT plan(19);

INSERT INTO auth.users (id, email)
VALUES ('90000000-0000-0000-0000-000000000001', 'release-durability@test.invalid');

-- Chat cards survive persistence and session metrics are derived from messages.
INSERT INTO public.chat_sessions (id, user_id, title)
VALUES (
  '91000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000001',
  'Durability test'
);

INSERT INTO public.chat_messages (
  id, user_id, session_id, role, content, cards, created_at
) VALUES
  (
    '92000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001',
    'user', 'first', '[]'::jsonb, '2026-08-12T10:00:00Z'
  ),
  (
    '92000000-0000-0000-0000-000000000002',
    '90000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001',
    'assistant', 'second', '[{"type":"stat","label":"Load","value":"42"}]'::jsonb,
    '2026-08-12T11:00:00Z'
  );

SELECT results_eq(
  $$
    SELECT message_count, last_message_at
    FROM public.chat_sessions
    WHERE id = '91000000-0000-0000-0000-000000000001'
  $$,
  $$ VALUES (2, '2026-08-12T11:00:00Z'::timestamptz) $$,
  'chat session metrics follow inserted messages'
);

SELECT is(
  (
    SELECT cards->0->>'type'
    FROM public.chat_messages
    WHERE id = '92000000-0000-0000-0000-000000000002'
  ),
  'stat',
  'rich chat cards survive persistence'
);

SELECT throws_ok(
  $$
    INSERT INTO public.chat_messages (user_id, session_id, role, content, cards)
    VALUES (
      '90000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000001',
      'assistant', 'invalid cards', '{}'::jsonb
    )
  $$,
  '23514',
  NULL,
  'chat cards must be a JSON array'
);

DELETE FROM public.chat_messages
WHERE id = '92000000-0000-0000-0000-000000000002';

SELECT is(
  (
    SELECT message_count
    FROM public.chat_sessions
    WHERE id = '91000000-0000-0000-0000-000000000001'
  ),
  1,
  'deleting a message decrements the derived session count'
);

-- Run completion and cursor advancement commit or roll back together.
SELECT lives_ok(
  $$ SELECT public.claim_cron_job('release-durability', 60) $$,
  'a cron lease can be claimed for finalization'
);

INSERT INTO public.cron_runs (id, job_name)
VALUES ('93000000-0000-0000-0000-000000000001', 'release-durability');

SELECT lives_ok(
  $$
    SELECT public.finalize_cron_run(
      '93000000-0000-0000-0000-000000000001',
      'release-durability',
      (SELECT lease_token FROM public.cron_job_state WHERE job_name = 'release-durability'),
      'user-42', 'success', 200, 42, 0, false, '{"ok":true}'::jsonb, NULL,
      '[{"itemKey":"poison-user","ok":false,"error":"boom"}]'::jsonb
    )
  $$,
  'cron run and cursor finalize atomically'
);

SELECT results_eq(
  $$
    SELECT run.status, run.processed, state.cursor, state.lease_token IS NULL
    FROM public.cron_runs run
    JOIN public.cron_job_state state ON state.job_name = run.job_name
    WHERE run.id = '93000000-0000-0000-0000-000000000001'
  $$,
  $$ VALUES ('success'::text, 42, 'user-42'::text, true) $$,
  'successful finalization stores matching run and cursor state'
);

SELECT results_eq(
  $$
    SELECT attempts, last_error, next_retry_at > now(), dead_lettered_at IS NULL
    FROM public.cron_item_failures
    WHERE job_name = 'release-durability' AND item_key = 'poison-user'
  $$,
  $$ VALUES (1, 'boom'::text, true, true) $$,
  'a failed item gets an observable retry with backoff'
);

INSERT INTO public.cron_runs (id, job_name)
VALUES ('93000000-0000-0000-0000-000000000002', 'release-durability');

SELECT throws_ok(
  $$
    SELECT public.finalize_cron_run(
      '93000000-0000-0000-0000-000000000002',
      'release-durability',
      '93000000-0000-0000-0000-000000000099',
      'bad-cursor', 'error', 500, 0, 1, false, '{}'::jsonb, 'stale lease', '[]'::jsonb
    )
  $$,
  'P0001',
  'Cron lease is missing or no longer owned',
  'a stale lease rejects the whole finalization'
);

SELECT is(
  (SELECT status FROM public.cron_runs WHERE id = '93000000-0000-0000-0000-000000000002'),
  'running',
  'a rejected lease rolls the run update back'
);

SELECT lives_ok(
  $test$
    DO $body$
    DECLARE token uuid;
    BEGIN
      token := (public.claim_cron_job('release-durability', 60)->>'lease_token')::uuid;
      UPDATE public.cron_item_failures SET attempts = 4
      WHERE job_name = 'release-durability' AND item_key = 'poison-user';
      INSERT INTO public.cron_runs (id, job_name)
      VALUES ('93000000-0000-0000-0000-000000000003', 'release-durability');
      PERFORM public.finalize_cron_run(
        '93000000-0000-0000-0000-000000000003', 'release-durability', token,
        NULL, 'partial', 503, 1, 1, false, '{}'::jsonb, 'still broken',
        '[{"itemKey":"poison-user","ok":false,"error":"still broken"}]'::jsonb
      );
    END;
    $body$;
  $test$,
  'the fifth failed attempt finalizes normally'
);

SELECT is(
  (
    SELECT dead_lettered_at IS NOT NULL
    FROM public.cron_item_failures
    WHERE job_name = 'release-durability' AND item_key = 'poison-user'
  ),
  true,
  'the fifth failed attempt dead-letters the item'
);

SELECT lives_ok(
  $test$
    DO $body$
    DECLARE token uuid;
    BEGIN
      token := (public.claim_cron_job('release-durability', 60)->>'lease_token')::uuid;
      INSERT INTO public.cron_runs (id, job_name)
      VALUES ('93000000-0000-0000-0000-000000000004', 'release-durability');
      PERFORM public.finalize_cron_run(
        '93000000-0000-0000-0000-000000000004', 'release-durability', token,
        NULL, 'success', 200, 1, 0, false, '{}'::jsonb, NULL,
        '[{"itemKey":"poison-user","ok":true}]'::jsonb
      );
    END;
    $body$;
  $test$,
  'a later successful retry can clear the dead letter'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.cron_item_failures
    WHERE job_name = 'release-durability' AND item_key = 'poison-user'
  ),
  0::bigint,
  'successful processing clears the item failure record'
);

-- Usage and reservation settlement commit or roll back together.
INSERT INTO public.ai_budget_reservations (
  id, user_id, estimated_cost_usd
) VALUES (
  '94000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000001',
  0.25
);

SELECT lives_ok(
  $$
    SELECT public.settle_ai_usage(
      '94000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000001',
      'release-test', 'claude-sonnet-4-6', 100, 20, 0, 0,
      0.01, 125, 'ok', NULL
    )
  $$,
  'usage recording settles its reservation'
);

SELECT results_eq(
  $$
    SELECT count(*)::bigint,
      (SELECT released_at IS NOT NULL FROM public.ai_budget_reservations
       WHERE id = '94000000-0000-0000-0000-000000000001')
    FROM public.ai_usage_log
    WHERE feature = 'release-test'
  $$,
  $$ VALUES (1::bigint, true) $$,
  'settlement writes one usage row and releases headroom'
);

INSERT INTO public.ai_budget_reservations (
  id, user_id, estimated_cost_usd
) VALUES (
  '94000000-0000-0000-0000-000000000002',
  '90000000-0000-0000-0000-000000000001',
  0.25
);

CREATE FUNCTION public.reject_release_test_usage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.feature = 'force-settlement-failure' THEN
    RAISE EXCEPTION 'forced usage insert failure';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reject_release_test_usage
BEFORE INSERT ON public.ai_usage_log
FOR EACH ROW EXECUTE FUNCTION public.reject_release_test_usage();

SELECT throws_ok(
  $$
    SELECT public.settle_ai_usage(
      '94000000-0000-0000-0000-000000000002',
      '90000000-0000-0000-0000-000000000001',
      'force-settlement-failure', 'claude-sonnet-4-6', 100, 20, 0, 0,
      0.01, 125, 'ok', NULL
    )
  $$,
  'P0001',
  'forced usage insert failure',
  'a failed usage write rejects settlement'
);

SELECT is(
  (
    SELECT released_at IS NULL
    FROM public.ai_budget_reservations
    WHERE id = '94000000-0000-0000-0000-000000000002'
  ),
  true,
  'a failed usage write leaves the reservation active'
);

SELECT is(
  (SELECT count(*) FROM public.ai_usage_log WHERE feature = 'force-settlement-failure'),
  0::bigint,
  'a failed settlement leaves no partial usage row'
);

SELECT * FROM finish();
ROLLBACK;
