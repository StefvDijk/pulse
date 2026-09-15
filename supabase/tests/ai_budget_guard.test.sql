BEGIN;
SELECT plan(4);

INSERT INTO auth.users (id, email)
VALUES ('80000000-0000-0000-0000-000000000001', 'ai-budget@test.invalid');

INSERT INTO public.ai_usage_log (
  user_id, feature, model, estimated_cost_usd
) VALUES (
  '80000000-0000-0000-0000-000000000001',
  'budget-test',
  'claude-sonnet-4-6',
  7
);

SELECT is(
  (
    public.reserve_ai_budget(
      '80000000-0000-0000-0000-000000000001', 10, 2
    )->>'warning'
  )::boolean,
  true,
  'a reservation crossing 70 percent raises the warning flag'
);

SELECT throws_ok(
  $$
    SELECT public.reserve_ai_budget(
      '80000000-0000-0000-0000-000000000001', 10, 2
    )
  $$,
  'P0001',
  'AI monthly budget exceeded',
  'active reservations participate in the hard cap'
);

SELECT lives_ok(
  $$
    SELECT public.release_ai_budget_reservation(
      '80000000-0000-0000-0000-000000000001',
      (
        SELECT id FROM public.ai_budget_reservations
        WHERE user_id = '80000000-0000-0000-0000-000000000001'
        ORDER BY created_at DESC LIMIT 1
      )
    )
  $$,
  'a completed call releases its reserved headroom'
);

SELECT lives_ok(
  $$
    SELECT public.reserve_ai_budget(
      '80000000-0000-0000-0000-000000000001', 10, 2
    )
  $$,
  'released headroom can be reserved by a later call'
);

SELECT * FROM finish();
ROLLBACK;
