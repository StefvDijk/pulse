-- Fix overly permissive RLS policies: restrict "all" policies to service_role only.
-- Without TO service_role, these USING(true) policies also apply to anon/authenticated,
-- allowing anyone with the public anon key to INSERT/UPDATE/DELETE data.

-- hevy_routines
DROP POLICY IF EXISTS "Service role full access to hevy_routines" ON hevy_routines;
CREATE POLICY "Service role full access to hevy_routines"
  ON hevy_routines FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- sleep_logs
DROP POLICY IF EXISTS "Service role full access to sleep_logs" ON sleep_logs;
CREATE POLICY "Service role full access to sleep_logs"
  ON sleep_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- body_weight_logs
DROP POLICY IF EXISTS "Service role full access to body_weight_logs" ON body_weight_logs;
CREATE POLICY "Service role full access to body_weight_logs"
  ON body_weight_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- coaching_memory
DROP POLICY IF EXISTS "service_role_all_memories" ON public.coaching_memory;
CREATE POLICY "service_role_all_memories"
  ON public.coaching_memory FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
