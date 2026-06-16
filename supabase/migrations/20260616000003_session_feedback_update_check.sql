-- Migration: harden session_feedback UPDATE policy.
--
-- 20260616000002 created the UPDATE policy with only a USING clause. In Postgres
-- RLS, USING gates which existing rows may be updated but does NOT re-validate
-- the resulting row — so an end-user JWT could reassign user_id on its own row,
-- moving it into another user's data. Add the WITH CHECK clause (mirroring
-- daily_checkins) so the new row must also belong to the caller. Defense in depth:
-- the app writes via the service-role client, but RLS should still hold.

ALTER POLICY "Users update own session_feedback" ON public.session_feedback
  WITH CHECK (auth.uid() = user_id);
