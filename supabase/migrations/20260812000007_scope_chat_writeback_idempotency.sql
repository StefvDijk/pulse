-- Scope retry keys to the authenticated owner. This keeps idempotency without
-- allowing one user's client-generated UUID to collide with another user.
DROP INDEX public.nutrition_logs_source_chat_turn_id_key;
CREATE UNIQUE INDEX nutrition_logs_user_turn_key
  ON public.nutrition_logs(user_id, source_chat_turn_id);

DROP INDEX public.injury_logs_source_chat_turn_id_key;
CREATE UNIQUE INDEX injury_logs_user_turn_key
  ON public.injury_logs(user_id, source_chat_turn_id);
