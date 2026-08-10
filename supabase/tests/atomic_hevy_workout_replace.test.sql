BEGIN;
SELECT plan(7);

INSERT INTO auth.users (id, email)
VALUES ('30000000-0000-0000-0000-000000000001', 'hevy-atomicity@test.invalid');

INSERT INTO public.exercise_definitions (
  id,
  name,
  primary_muscle_group,
  movement_pattern
)
VALUES (
  '40000000-0000-0000-0000-000000000001',
  'Atomic test squat',
  'quads',
  'squat'
);

SELECT lives_ok(
  $test$
    SELECT public.replace_hevy_workout_atomic(
      '30000000-0000-0000-0000-000000000001',
      'hevy-atomic-1',
      '{
        "user_id":"30000000-0000-0000-0000-000000000001",
        "hevy_workout_id":"hevy-atomic-1",
        "title":"Initial workout",
        "source":"hevy",
        "started_at":"2026-08-10T10:00:00Z",
        "total_volume_kg":500,
        "set_count":1,
        "exercise_count":1
      }'::jsonb,
      '[{
        "exercise_definition_id":"40000000-0000-0000-0000-000000000001",
        "exercise_order":0,
        "notes":null,
        "sets":[{
          "set_order":0,
          "set_type":"normal",
          "weight_kg":100,
          "reps":5
        }]
      }]'::jsonb
    )
  $test$,
  'an initial workout graph is inserted'
);

SELECT results_eq(
  $test$
    SELECT
      count(DISTINCT we.id)::bigint,
      count(ws.id)::bigint,
      max(ws.weight_kg)
    FROM public.workouts w
    JOIN public.workout_exercises we ON we.workout_id = w.id
    JOIN public.workout_sets ws ON ws.workout_exercise_id = we.id
    WHERE w.hevy_workout_id = 'hevy-atomic-1'
  $test$,
  $$ VALUES (1::bigint, 1::bigint, 100::numeric) $$,
  'the complete initial child graph is present'
);

SELECT lives_ok(
  $test$
    SELECT public.replace_hevy_workout_atomic(
      '30000000-0000-0000-0000-000000000001',
      'hevy-atomic-1',
      '{
        "user_id":"30000000-0000-0000-0000-000000000001",
        "hevy_workout_id":"hevy-atomic-1",
        "title":"Edited workout",
        "source":"hevy",
        "started_at":"2026-08-10T10:00:00Z",
        "total_volume_kg":900,
        "set_count":2,
        "exercise_count":1
      }'::jsonb,
      '[{
        "exercise_definition_id":"40000000-0000-0000-0000-000000000001",
        "exercise_order":0,
        "notes":"edited",
        "sets":[
          {"set_order":0,"set_type":"normal","weight_kg":90,"reps":5},
          {"set_order":1,"set_type":"normal","weight_kg":90,"reps":5}
        ]
      }]'::jsonb
    )
  $test$,
  'a re-delivery replaces the graph'
);

SELECT results_eq(
  $test$
    SELECT w.title, count(ws.id)::bigint, max(ws.weight_kg)
    FROM public.workouts w
    JOIN public.workout_exercises we ON we.workout_id = w.id
    JOIN public.workout_sets ws ON ws.workout_exercise_id = we.id
    WHERE w.hevy_workout_id = 'hevy-atomic-1'
    GROUP BY w.title
  $test$,
  $$ VALUES ('Edited workout'::text, 2::bigint, 90::numeric) $$,
  'only the edited graph remains'
);

SELECT throws_ok(
  $test$
    SELECT public.replace_hevy_workout_atomic(
      '30000000-0000-0000-0000-000000000001',
      'hevy-atomic-1',
      '{
        "user_id":"30000000-0000-0000-0000-000000000001",
        "hevy_workout_id":"hevy-atomic-1",
        "title":"Broken edit",
        "source":"hevy",
        "started_at":"2026-08-10T10:00:00Z",
        "total_volume_kg":1,
        "set_count":1,
        "exercise_count":1
      }'::jsonb,
      '[{
        "exercise_definition_id":"40000000-0000-0000-0000-000000000001",
        "exercise_order":0,
        "sets":[{
          "set_order":0,
          "set_type":"normal",
          "weight_kg":1,
          "reps":1,
          "rpe":99
        }]
      }]'::jsonb
    )
  $test$,
  '23514',
  'new row for relation "workout_sets" violates check constraint "workout_sets_rpe_check"',
  'a child constraint failure aborts the replace'
);

SELECT results_eq(
  $test$
    SELECT w.title, count(ws.id)::bigint, max(ws.weight_kg)
    FROM public.workouts w
    JOIN public.workout_exercises we ON we.workout_id = w.id
    JOIN public.workout_sets ws ON ws.workout_exercise_id = we.id
    WHERE w.hevy_workout_id = 'hevy-atomic-1'
    GROUP BY w.title
  $test$,
  $$ VALUES ('Edited workout'::text, 2::bigint, 90::numeric) $$,
  'the previous graph survives a failed replace'
);

SELECT throws_ok(
  $test$
    SELECT public.replace_hevy_workout_atomic(
      '30000000-0000-0000-0000-000000000001',
      'different-id',
      '{
        "user_id":"30000000-0000-0000-0000-000000000001",
        "hevy_workout_id":"hevy-atomic-1"
      }'::jsonb,
      '[]'::jsonb
    )
  $test$,
  'P0001',
  'Hevy workout identity does not match RPC arguments',
  'identity mismatches are rejected'
);

SELECT * FROM finish();
ROLLBACK;
