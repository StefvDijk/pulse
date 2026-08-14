BEGIN;
SELECT plan(19);

INSERT INTO auth.users (id, email)
VALUES ('10000000-0000-0000-0000-000000000001', 'schema-atomicity@test.invalid');

INSERT INTO public.training_schemas (
  id,
  user_id,
  title,
  schema_type,
  start_date,
  is_active,
  workout_schedule
)
VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Old active',
    'custom',
    '2026-01-01',
    true,
    '[]'::jsonb
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'New candidate',
    'custom',
    '2026-08-11',
    false,
    '[]'::jsonb
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'Failing candidate',
    'custom',
    '2026-08-11',
    false,
    '[]'::jsonb
  );

SELECT throws_ok(
  $$
    UPDATE public.training_schemas
    SET is_active = true
    WHERE id = '20000000-0000-0000-0000-000000000002'
  $$,
  '23505',
  'duplicate key value violates unique constraint "training_schemas_one_active_per_user_idx"',
  'the unique index rejects a second active schema'
);

SELECT lives_ok(
  $$
    SELECT public.activate_training_schema(
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000001',
      '2026-08-10'
    )
  $$,
  'the RPC switches active schemas'
);

SELECT results_eq(
  $$
    SELECT id
    FROM public.training_schemas
    WHERE user_id = '10000000-0000-0000-0000-000000000001'
      AND is_active IS TRUE
  $$,
  $$ VALUES ('20000000-0000-0000-0000-000000000002'::uuid) $$,
  'exactly the requested schema is active'
);

CREATE FUNCTION public.reject_test_schema_activation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'forced activation failure';
END;
$$;

CREATE TRIGGER reject_test_schema_activation
BEFORE UPDATE ON public.training_schemas
FOR EACH ROW
WHEN (
  NEW.id = '20000000-0000-0000-0000-000000000003'::uuid
  AND NEW.is_active IS TRUE
)
EXECUTE FUNCTION public.reject_test_schema_activation();

SELECT throws_ok(
  $$
    SELECT public.activate_training_schema(
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000003'
    )
  $$,
  'P0001',
  'forced activation failure',
  'a final-step failure is surfaced'
);

SELECT results_eq(
  $$
    SELECT id
    FROM public.training_schemas
    WHERE user_id = '10000000-0000-0000-0000-000000000001'
      AND is_active IS TRUE
  $$,
  $$ VALUES ('20000000-0000-0000-0000-000000000002'::uuid) $$,
  'the previous active schema survives a failed switch'
);

DROP TRIGGER reject_test_schema_activation ON public.training_schemas;
CREATE TRIGGER reject_test_schema_activation
BEFORE UPDATE ON public.training_schemas
FOR EACH ROW
WHEN (NEW.title = 'Atomic orphan candidate' AND NEW.is_active IS TRUE)
EXECUTE FUNCTION public.reject_test_schema_activation();

SELECT throws_ok(
  $test$
    SELECT public.insert_and_activate_training_schema(
      '10000000-0000-0000-0000-000000000001',
      '{
        "user_id":"10000000-0000-0000-0000-000000000001",
        "title":"Atomic orphan candidate",
        "schema_type":"custom",
        "weeks_planned":4,
        "start_date":"2026-08-11",
        "workout_schedule":[],
        "progression_rules":{},
        "quality_audit":{},
        "planned_weekly_load":{},
        "ai_generated":true
      }'::jsonb,
      '20000000-0000-0000-0000-000000000002',
      '2026-08-10'
    )
  $test$,
  'P0001',
  'forced activation failure',
  'an activation failure aborts the insert-and-switch transaction'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.training_schemas
    WHERE title = 'Atomic orphan candidate'
  ),
  0::bigint,
  'a failed activation leaves no orphan inactive schema'
);

SELECT results_eq(
  $$
    SELECT id
    FROM public.training_schemas
    WHERE user_id = '10000000-0000-0000-0000-000000000001'
      AND is_active IS TRUE
  $$,
  $$ VALUES ('20000000-0000-0000-0000-000000000002'::uuid) $$,
  'the prior schema remains active after insert-and-switch rollback'
);

SELECT lives_ok(
  $test$
    SELECT public.insert_and_activate_training_schema(
      '10000000-0000-0000-0000-000000000001',
      '{
        "user_id":"10000000-0000-0000-0000-000000000001",
        "title":"Chat successor",
        "schema_type":"custom",
        "weeks_planned":4,
        "start_date":"2026-09-08",
        "workout_schedule":[],
        "source_chat_turn_id":"21000000-0000-4000-8000-000000000001"
      }'::jsonb,
      '20000000-0000-0000-0000-000000000002'
    )
  $test$,
  'chat schema generation activates and summarizes in one transaction'
);

SELECT results_eq(
  $$ SELECT count(*)::bigint, bool_and(old.end_date IS NOT NULL)
     FROM public.schema_block_summaries summary
     JOIN public.training_schemas old ON old.id=summary.schema_id
     WHERE summary.schema_id='20000000-0000-0000-0000-000000000002' $$,
  $$ VALUES (1::bigint,true) $$,
  'the previous block summary and end date commit together'
);

SELECT lives_ok(
  $test$
    SELECT public.insert_and_activate_training_schema(
      '10000000-0000-0000-0000-000000000001',
      '{
        "user_id":"10000000-0000-0000-0000-000000000001",
        "title":"Chat successor",
        "schema_type":"custom",
        "weeks_planned":4,
        "start_date":"2026-09-08",
        "workout_schedule":[],
        "source_chat_turn_id":"21000000-0000-4000-8000-000000000001"
      }'::jsonb,
      '20000000-0000-0000-0000-000000000002'
    )
  $test$,
  'a retried chat schema generation is accepted idempotently'
);

SELECT results_eq(
  $$ SELECT
       (SELECT count(*) FROM public.training_schemas WHERE title='Chat successor')::bigint,
       (SELECT count(*) FROM public.schema_block_summaries
        WHERE schema_id='20000000-0000-0000-0000-000000000002')::bigint $$,
  $$ VALUES (1::bigint,1::bigint) $$,
  'schema-generation replay duplicates neither schema nor summary'
);

SELECT is(
  public.apply_chat_schema_update_once(
    '10000000-0000-0000-0000-000000000001',
    '22000000-0000-4000-8000-000000000001',
    (SELECT id FROM public.training_schemas WHERE title='Chat successor'),
    '[]'::jsonb,'[{"day":"monday","focus":"test","exercises":[]}]'::jsonb,
    'testdag toegevoegd'
  )->>'applied',
  'true',
  'chat schema update applies through its transactional ledger'
);

SELECT results_eq(
  $$ SELECT schema.workout_schedule,
       EXISTS(SELECT 1 FROM public.coaching_memory
              WHERE user_id=schema.user_id AND value LIKE '%testdag toegevoegd%'),
       EXISTS(SELECT 1 FROM public.chat_writeback_operations
              WHERE user_id=schema.user_id
                AND turn_id='22000000-0000-4000-8000-000000000001')
     FROM public.training_schemas schema WHERE title='Chat successor' $$,
  $$ VALUES ('[{"day":"monday","focus":"test","exercises":[]}]'::jsonb,true,true) $$,
  'schedule, coaching memory and replay ledger commit together'
);

SELECT is(
  public.apply_chat_schema_update_once(
    '10000000-0000-0000-0000-000000000001',
    '22000000-0000-4000-8000-000000000001',
    (SELECT id FROM public.training_schemas WHERE title='Chat successor'),
    '[]'::jsonb,'[{"day":"different"}]'::jsonb,'different retry'
  )->>'replayed',
  'true',
  'schema update replay returns the first committed result'
);

CREATE FUNCTION public.reject_test_schema_memory()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'forced schema memory failure'; END;
$$;
CREATE TRIGGER reject_test_schema_memory
BEFORE INSERT OR UPDATE ON public.coaching_memory
FOR EACH ROW EXECUTE FUNCTION public.reject_test_schema_memory();

SELECT throws_ok(
  $test$
    SELECT public.apply_chat_schema_update_once(
      '10000000-0000-0000-0000-000000000001',
      '22000000-0000-4000-8000-000000000002',
      (SELECT id FROM public.training_schemas WHERE title='Chat successor'),
      '[{"day":"monday","focus":"test","exercises":[]}]'::jsonb,
      '[{"day":"tuesday","focus":"changed","exercises":[]}]'::jsonb,
      'must roll back'
    )
  $test$,
  'P0001',
  'forced schema memory failure',
  'a coaching-memory failure aborts the schema update'
);

SELECT results_eq(
  $$ SELECT workout_schedule,
       EXISTS(SELECT 1 FROM public.chat_writeback_operations
              WHERE turn_id='22000000-0000-4000-8000-000000000002')
     FROM public.training_schemas WHERE title='Chat successor' $$,
  $$ VALUES ('[{"day":"monday","focus":"test","exercises":[]}]'::jsonb,false) $$,
  'failed memory write leaves schedule and replay ledger unchanged'
);

DROP TRIGGER reject_test_schema_memory ON public.coaching_memory;

CREATE FUNCTION public.reject_test_block_summary()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'forced block summary failure'; END;
$$;
CREATE TRIGGER reject_test_block_summary
BEFORE INSERT ON public.schema_block_summaries
FOR EACH ROW EXECUTE FUNCTION public.reject_test_block_summary();

SELECT throws_ok(
  $test$
    SELECT public.insert_and_activate_training_schema(
      '10000000-0000-0000-0000-000000000001',
      '{
        "user_id":"10000000-0000-0000-0000-000000000001",
        "title":"Summary failure candidate",
        "schema_type":"custom",
        "weeks_planned":4,
        "start_date":"2026-10-06",
        "workout_schedule":[],
        "source_chat_turn_id":"21000000-0000-4000-8000-000000000002"
      }'::jsonb,
      (SELECT id FROM public.training_schemas WHERE title='Chat successor')
    )
  $test$,
  'P0001',
  'forced block summary failure',
  'a block-summary failure aborts schema insert and activation'
);

SELECT results_eq(
  $$ SELECT
       (SELECT count(*) FROM public.training_schemas WHERE title='Summary failure candidate')::bigint,
       (SELECT title FROM public.training_schemas
        WHERE user_id='10000000-0000-0000-0000-000000000001' AND is_active=true) $$,
  $$ VALUES (0::bigint,'Chat successor'::text) $$,
  'summary failure leaves no candidate and preserves the active schema'
);

SELECT * FROM finish();
ROLLBACK;
