BEGIN;
CREATE EXTENSION IF NOT EXISTS dblink;
SELECT plan(3);

SELECT dblink_connect(
  'hevy_setup',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres'
);
SELECT dblink_exec(
  'hevy_setup',
  $setup$
    INSERT INTO auth.users (id, email)
    VALUES ('60000000-0000-0000-0000-000000000001', 'hevy-concurrency@test.invalid');
    INSERT INTO public.exercise_definitions (
      id, name, primary_muscle_group, movement_pattern
    ) VALUES (
      '61000000-0000-0000-0000-000000000001',
      'Concurrent test press',
      'chest',
      'horizontal_push'
    );
  $setup$
);
SELECT dblink_disconnect('hevy_setup');

SELECT dblink_connect(
  'hevy_first',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres'
);
SELECT dblink_connect(
  'hevy_second',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres'
);

DO $$
BEGIN
  IF dblink_send_query(
    'hevy_first',
    $first$
      WITH held AS MATERIALIZED (
        SELECT
          pg_advisory_xact_lock(
            hashtextextended('hevy-workouts:60000000-0000-0000-0000-000000000001', 0)
          ),
          pg_sleep(0.5)
      )
      SELECT public.replace_hevy_workout_atomic(
        '60000000-0000-0000-0000-000000000001',
        'concurrent-first',
        '{
          "user_id":"60000000-0000-0000-0000-000000000001",
          "hevy_workout_id":"concurrent-first",
          "title":"Concurrent first",
          "source":"hevy",
          "started_at":"2026-08-01T10:00:00Z",
          "set_count":1,
          "exercise_count":1
        }'::jsonb,
        '[{
          "exercise_definition_id":"61000000-0000-0000-0000-000000000001",
          "exercise_order":0,
          "sets":[{"set_order":0,"set_type":"normal","weight_kg":100,"reps":5}]
        }]'::jsonb
      )
      FROM held;
    $first$
  ) <> 1 THEN
    RAISE EXCEPTION 'failed to dispatch first concurrent query';
  END IF;

  IF dblink_send_query(
    'hevy_second',
    $second$
      SELECT public.replace_hevy_workout_atomic(
        '60000000-0000-0000-0000-000000000001',
        'concurrent-second',
        '{
          "user_id":"60000000-0000-0000-0000-000000000001",
          "hevy_workout_id":"concurrent-second",
          "title":"Concurrent second",
          "source":"hevy",
          "started_at":"2026-08-08T10:00:00Z",
          "set_count":1,
          "exercise_count":1
        }'::jsonb,
        '[{
          "exercise_definition_id":"61000000-0000-0000-0000-000000000001",
          "exercise_order":0,
          "sets":[{"set_order":0,"set_type":"normal","weight_kg":110,"reps":5}]
        }]'::jsonb
      );
    $second$
  ) <> 1 THEN
    RAISE EXCEPTION 'failed to dispatch second concurrent query';
  END IF;
END;
$$;

SELECT lives_ok(
  $$ SELECT * FROM dblink_get_result('hevy_first') AS result(workout_id uuid) $$,
  'the first database session completes its locked replacement'
);
SELECT lives_ok(
  $$ SELECT * FROM dblink_get_result('hevy_second') AS result(workout_id uuid) $$,
  'the overlapping database session resumes and completes'
);

SELECT results_eq(
  $test$
    SELECT
      count(DISTINCT w.id)::bigint,
      count(DISTINCT we.id)::bigint,
      count(DISTINCT ws.id)::bigint,
      count(DISTINCT pr.id)::bigint,
      sum(w.pr_count)::bigint
    FROM public.workouts w
    JOIN public.workout_exercises we ON we.workout_id = w.id
    JOIN public.workout_sets ws ON ws.workout_exercise_id = we.id
    LEFT JOIN public.personal_records pr ON pr.workout_id = w.id
    WHERE w.user_id = '60000000-0000-0000-0000-000000000001'
  $test$,
  $$ VALUES (2::bigint, 2::bigint, 2::bigint, 2::bigint, 2::bigint) $$,
  'concurrent replacements preserve both graphs and the chronological PR chain'
);

SELECT dblink_disconnect('hevy_first');
SELECT dblink_disconnect('hevy_second');
SELECT dblink_connect(
  'hevy_cleanup',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres'
);
SELECT dblink_exec(
  'hevy_cleanup',
  $$
    DELETE FROM auth.users WHERE id = '60000000-0000-0000-0000-000000000001';
    DELETE FROM public.exercise_definitions WHERE id = '61000000-0000-0000-0000-000000000001';
  $$
);
SELECT dblink_disconnect('hevy_cleanup');

SELECT * FROM finish();
ROLLBACK;
