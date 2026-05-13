-- A6: RLS verify query.
--
-- Run in Supabase SQL editor (production project, not local).
-- Confirms that the four tables flagged in fase 4 (SEC-07, SEC-08) have
-- restrictive policies and not the over-broad USING (true).
--
-- Expected outcome: every row returned should show roles = {authenticated}
-- or roles = {service_role}; the qual column should never be `true` for
-- non-service_role rows.

SELECT
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'coaching_memory',
    'hevy_routines',
    'sleep_logs',
    'body_weight_logs'
  )
ORDER BY tablename, policyname;

-- Sanity check on the rest of the project — quick visual scan for
-- any `qual = 'true'` policies that aren't scoped to service_role.
SELECT
  tablename,
  policyname,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND qual = 'true'
  AND NOT (roles::text[] @> ARRAY['service_role']::text[])
ORDER BY tablename, policyname;
