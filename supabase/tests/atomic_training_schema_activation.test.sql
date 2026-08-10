BEGIN;
SELECT plan(8);

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

SELECT * FROM finish();
ROLLBACK;
