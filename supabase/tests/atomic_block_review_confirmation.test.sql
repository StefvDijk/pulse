BEGIN;
SELECT plan(7);

INSERT INTO auth.users (id, email)
VALUES ('50000000-0000-0000-0000-000000000001', 'block-review-atomicity@test.invalid');

INSERT INTO public.training_schemas (
  id, user_id, title, schema_type, start_date, is_active, workout_schedule
) VALUES (
  '51000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  'Source block',
  'custom',
  '2026-07-01',
  true,
  '[]'::jsonb
);

INSERT INTO public.block_reviews (
  id, user_id, schema_id, period_start, period_end, status, end_reason
) VALUES (
  '52000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000001',
  '2026-07-01',
  '2026-08-10',
  'draft',
  'completed'
);

SELECT lives_ok(
  $test$
    SELECT public.finalize_block_review_v2(
      '50000000-0000-0000-0000-000000000001',
      '52000000-0000-0000-0000-000000000001',
      '51000000-0000-0000-0000-000000000001',
      '2026-08-10',
      '{"period_start":"2026-07-01","period_end":"2026-08-10","end_reason":"completed","biggest_win":"Atomic win"}'::jsonb,
      '{
        "user_id":"50000000-0000-0000-0000-000000000001",
        "title":"Successor block",
        "schema_type":"custom",
        "weeks_planned":4,
        "start_date":"2026-08-11",
        "workout_schedule":[],
        "source_block_review_id":"52000000-0000-0000-0000-000000000001"
      }'::jsonb,
      '{"date":"2026-08-10","weight_kg":80.5}'::jsonb,
      '{"summary":"Atomic summary","exercises_used":["Squat"],"adherence_percentage":90,"total_sessions_planned":10,"total_sessions_completed":9,"end_reason":"completed"}'::jsonb,
      '{}'::uuid[]
    )
  $test$,
  'finalization commits the review and successor together'
);

SELECT results_eq(
  $test$
    SELECT br.status, (br.next_schema_id = ts.id), ts.is_active
    FROM public.block_reviews br
    JOIN public.training_schemas ts ON ts.id = br.next_schema_id
    WHERE br.id = '52000000-0000-0000-0000-000000000001'
  $test$,
  $$ VALUES ('confirmed'::text, true, true) $$,
  'the confirmed review links to the one active successor'
);

SELECT results_eq(
  $test$
    SELECT
      (SELECT count(*) FROM public.body_composition_logs WHERE user_id = '50000000-0000-0000-0000-000000000001')::bigint,
      (SELECT count(*) FROM public.schema_block_summaries WHERE user_id = '50000000-0000-0000-0000-000000000001')::bigint
  $test$,
  $$ VALUES (1::bigint, 1::bigint) $$,
  'the optional body measurement and summary commit in the same flow'
);

SELECT is(
  (
    public.finalize_block_review_v2(
      '50000000-0000-0000-0000-000000000001',
      '52000000-0000-0000-0000-000000000001',
      '51000000-0000-0000-0000-000000000001',
      '2026-08-10',
      '{}'::jsonb,
      '{}'::jsonb
    )->>'already_confirmed'
  )::boolean,
  true,
  'a retry returns the committed result idempotently'
);

SELECT is(
  (SELECT count(*) FROM public.training_schemas WHERE title = 'Successor block'),
  1::bigint,
  'an idempotent retry does not create a duplicate successor'
);

INSERT INTO public.block_reviews (
  id, user_id, schema_id, period_start, period_end, status, end_reason
) VALUES (
  '52000000-0000-0000-0000-000000000002',
  '50000000-0000-0000-0000-000000000001',
  (SELECT next_schema_id FROM public.block_reviews WHERE id = '52000000-0000-0000-0000-000000000001'),
  '2026-08-11',
  '2026-09-10',
  'draft',
  'completed'
);

CREATE FUNCTION public.reject_broken_successor()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'forced successor failure';
END;
$$;

CREATE TRIGGER reject_broken_successor
BEFORE INSERT ON public.training_schemas
FOR EACH ROW
WHEN (NEW.title = 'Broken successor')
EXECUTE FUNCTION public.reject_broken_successor();

SELECT throws_ok(
  $test$
    SELECT public.finalize_block_review_v2(
      '50000000-0000-0000-0000-000000000001',
      '52000000-0000-0000-0000-000000000002',
      (SELECT next_schema_id FROM public.block_reviews WHERE id = '52000000-0000-0000-0000-000000000001'),
      '2026-09-10',
      '{"period_start":"2026-08-11","period_end":"2026-09-10","end_reason":"completed"}'::jsonb,
      '{
        "user_id":"50000000-0000-0000-0000-000000000001",
        "title":"Broken successor",
        "schema_type":"custom",
        "weeks_planned":4,
        "start_date":"2026-09-11",
        "workout_schedule":[],
        "source_block_review_id":"52000000-0000-0000-0000-000000000002"
      }'::jsonb
    )
  $test$,
  'P0001',
  'forced successor failure',
  'a successor failure aborts finalization'
);

SELECT results_eq(
  $test$
    SELECT br.status, br.next_schema_id, ts.is_active
    FROM public.block_reviews br
    JOIN public.training_schemas ts ON ts.id = br.schema_id
    WHERE br.id = '52000000-0000-0000-0000-000000000002'
  $test$,
  $$ VALUES ('draft'::text, NULL::uuid, true) $$,
  'failed finalization leaves the draft and prior active schema intact'
);

SELECT * FROM finish();
ROLLBACK;
