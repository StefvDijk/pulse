BEGIN;
SELECT plan(40);

INSERT INTO auth.users (id, email)
VALUES
  ('90000000-0000-0000-0000-000000000001', 'release-durability@test.invalid'),
  ('90000000-0000-0000-0000-000000000002', 'release-durability-other@test.invalid');

-- Chat cards survive persistence and session metrics are derived from messages.
INSERT INTO public.chat_sessions (id, user_id, title)
VALUES (
  '91000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000001',
  'Durability test'
);

SELECT is(
  public.resolve_chat_session_for_turn(
    '90000000-0000-0000-0000-000000000001','91500000-0000-4000-8000-000000000001','manager','first'
  )->>'id',
  public.resolve_chat_session_for_turn(
    '90000000-0000-0000-0000-000000000001','91500000-0000-4000-8000-000000000001','manager','retry'
  )->>'id',
  'a retried first turn resolves to the original session'
);

SELECT is(
  (public.claim_chat_turn(
    '90000000-0000-0000-0000-000000000001','91500000-0000-4000-8000-000000000002',
    '91000000-0000-0000-0000-000000000001',repeat('a',64),90
  )->>'claimed')::boolean,
  true,
  'the first worker atomically claims a chat turn'
);

SELECT is(
  (public.claim_chat_turn(
    '90000000-0000-0000-0000-000000000001','91500000-0000-4000-8000-000000000002',
    '91000000-0000-0000-0000-000000000001',repeat('a',64),90
  )->>'claimed')::boolean,
  false,
  'a concurrent worker cannot claim the same chat turn'
);

SELECT lives_ok(
  $$ SELECT public.store_chat_turn_response(
    '90000000-0000-0000-0000-000000000001','91500000-0000-4000-8000-000000000002',
    (SELECT lease_token FROM public.chat_turn_executions
     WHERE user_id='90000000-0000-0000-0000-000000000001'
       AND turn_id='91500000-0000-4000-8000-000000000002'),
    'first durable model intent'
  );
  SELECT public.store_chat_turn_response(
    '90000000-0000-0000-0000-000000000001','91500000-0000-4000-8000-000000000002',
    (SELECT lease_token FROM public.chat_turn_executions
     WHERE user_id='90000000-0000-0000-0000-000000000001'
       AND turn_id='91500000-0000-4000-8000-000000000002'),
    'different retry output'
  ) $$,
  'the lease owner can durably store chat intent before write-backs'
);

SELECT is(
  (SELECT generated_response FROM public.chat_turn_executions
   WHERE user_id='90000000-0000-0000-0000-000000000001'
     AND turn_id='91500000-0000-4000-8000-000000000002'),
  'first durable model intent',
  'the first complete model intent wins across retries'
);

SELECT lives_ok(
  $$ SELECT public.complete_chat_turn(
    '90000000-0000-0000-0000-000000000001','91500000-0000-4000-8000-000000000002',
    (SELECT lease_token FROM public.chat_turn_executions
     WHERE user_id='90000000-0000-0000-0000-000000000001'
       AND turn_id='91500000-0000-4000-8000-000000000002')
  ) $$,
  'the owning worker can complete its chat turn'
);

SELECT is(
  (public.claim_chat_turn(
    '90000000-0000-0000-0000-000000000001','91500000-0000-4000-8000-000000000002',
    '91000000-0000-0000-0000-000000000001',repeat('a',64),90
  )->>'completed')::boolean,
  true,
  'a completed turn is replay-only'
);

SELECT throws_ok(
  $$ SELECT public.claim_chat_turn(
    '90000000-0000-0000-0000-000000000001','91500000-0000-4000-8000-000000000002',
    '91000000-0000-0000-0000-000000000001',repeat('b',64),90
  ) $$,
  'P0001',
  'Chat turn identity does not match original request',
  'a turn id cannot be reused for different request content'
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

SELECT throws_ok(
  $$
    INSERT INTO public.chat_messages (user_id, session_id, role, content)
    VALUES (
      '90000000-0000-0000-0000-000000000002',
      '91000000-0000-0000-0000-000000000001',
      'user', 'cross-owner message'
    )
  $$,
  '23503',
  NULL,
  'a chat message cannot be linked to another users session'
);

INSERT INTO public.nutrition_logs (
  user_id, date, raw_input, source_chat_turn_id
) VALUES (
  '90000000-0000-0000-0000-000000000001',
  '2026-08-12',
  'first retry-safe log',
  '92500000-0000-4000-8000-000000000001'
);

SELECT throws_ok(
  $$
    INSERT INTO public.nutrition_logs (
      user_id, date, raw_input, source_chat_turn_id
    ) VALUES (
      '90000000-0000-0000-0000-000000000001',
      '2026-08-12',
      'duplicate retry',
      '92500000-0000-4000-8000-000000000001'
    )
  $$,
  '23505',
  NULL,
  'a retried chat turn cannot create a duplicate nutrition log'
);

SELECT lives_ok(
  $$
    INSERT INTO public.chat_messages(user_id,session_id,role,content,message_type,source_chat_turn_id)
    VALUES ('90000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001',
      'assistant','retry-safe','general','92500000-0000-4000-8000-000000000002')
    ON CONFLICT (user_id,source_chat_turn_id,role,message_type) DO NOTHING;
    INSERT INTO public.chat_messages(user_id,session_id,role,content,message_type,source_chat_turn_id)
    VALUES ('90000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001',
      'assistant','retry-safe','general','92500000-0000-4000-8000-000000000002')
    ON CONFLICT (user_id,source_chat_turn_id,role,message_type) DO NOTHING
  $$,
  'a retried assistant message is accepted idempotently'
);

SELECT is(
  (SELECT count(*) FROM public.chat_messages WHERE source_chat_turn_id='92500000-0000-4000-8000-000000000002'),
  1::bigint,
  'a retried assistant message remains one row'
);

SELECT lives_ok(
  $$ SELECT public.save_nutrition_log_atomic(
    '90000000-0000-0000-0000-000000000001',
    '{"date":"2026-08-13","raw_input":"kwark","estimated_calories":220,"estimated_protein_g":28,"estimated_carbs_g":12.5,"estimated_fat_g":4,"estimated_fiber_g":0,"meal_type":"snack","confidence":"high","ai_analysis":"[]","source_chat_turn_id":"92500000-0000-4000-8000-000000000003"}'::jsonb
  ) $$,
  'atomic nutrition save commits log and summary'
);

UPDATE public.chat_messages SET cards = jsonb_build_array(jsonb_build_object(
  'type','writeback_card','kind','nutrition','label','Voeding gelogd','status','saved',
  'record_id',(SELECT id::text FROM public.nutrition_logs WHERE source_chat_turn_id='92500000-0000-4000-8000-000000000003')
)) WHERE source_chat_turn_id='92500000-0000-4000-8000-000000000002';

SELECT is(
  (SELECT total_calories FROM public.daily_nutrition_summary
   WHERE user_id='90000000-0000-0000-0000-000000000001' AND date='2026-08-13'),
  220::numeric,
  'atomic nutrition save derives the daily summary'
);

SELECT is(
  (public.save_nutrition_log_atomic(
    '90000000-0000-0000-0000-000000000001',
    '{"date":"2026-08-13","raw_input":"different retry","estimated_calories":999,"estimated_protein_g":1,"estimated_carbs_g":1,"estimated_fat_g":1,"estimated_fiber_g":1,"meal_type":"snack","confidence":"low","ai_analysis":"[]","source_chat_turn_id":"92500000-0000-4000-8000-000000000003"}'::jsonb
  )->>'estimated_calories')::numeric,
  220::numeric,
  'a nutrition retry returns the first durable macro values'
);

SELECT lives_ok(
  $$ SELECT public.undo_chat_nutrition_log(
    '90000000-0000-0000-0000-000000000001',
    (SELECT id FROM public.nutrition_logs WHERE source_chat_turn_id='92500000-0000-4000-8000-000000000003')
  ) $$,
  'atomic nutrition undo deletes and recomputes'
);

SELECT is(
  (SELECT cards->0->>'status' FROM public.chat_messages
   WHERE source_chat_turn_id='92500000-0000-4000-8000-000000000002'),
  'undone',
  'nutrition undo persists the restored card status'
);

SELECT is(
  (SELECT total_calories FROM public.daily_nutrition_summary
   WHERE user_id='90000000-0000-0000-0000-000000000001' AND date='2026-08-13'),
  0::numeric,
  'nutrition undo recomputes the daily summary in the same transaction'
);

DELETE FROM public.chat_messages
WHERE id = '92000000-0000-0000-0000-000000000002';

SELECT is(
  (
    SELECT message_count
    FROM public.chat_sessions
    WHERE id = '91000000-0000-0000-0000-000000000001'
  ),
  2,
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
  '94000000-0000-0000-0000-000000000003',
  '90000000-0000-0000-0000-000000000001',
  0.33
);

SELECT lives_ok(
  $$
    SELECT public.settle_ai_usage(
      '94000000-0000-0000-0000-000000000003',
      '90000000-0000-0000-0000-000000000001',
      'unknown-provider-usage', 'claude-sonnet-4-6',
      NULL, NULL, NULL, NULL, 0, 125, 'error', 'STREAM_ERROR'
    )
  $$,
  'unknown provider usage can settle without reported token counts'
);

SELECT is(
  (
    SELECT estimated_cost_usd
    FROM public.ai_usage_log
    WHERE feature = 'unknown-provider-usage'
  ),
  0.33::numeric,
  'unknown provider usage settles at the conservative reservation cost'
);

INSERT INTO public.ai_budget_reservations(
  id,user_id,estimated_cost_usd,expires_at
) VALUES (
  '94000000-0000-0000-0000-000000000004',
  '90000000-0000-0000-0000-000000000001',0.39,now()-interval '1 day'
);

SELECT throws_ok(
  $$ SELECT public.reserve_ai_budget(
    '90000000-0000-0000-0000-000000000001',0.40,0.02
  ) $$,
  'P0001',
  'AI monthly budget exceeded',
  'an expired but unsettled reservation still holds monthly budget headroom'
);
UPDATE public.ai_budget_reservations SET released_at=now()
WHERE id='94000000-0000-0000-0000-000000000004';

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
