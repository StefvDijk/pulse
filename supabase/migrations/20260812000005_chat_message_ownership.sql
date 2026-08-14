-- A message and its session must have the same owner. Route checks are not
-- enough because authenticated clients can also write through PostgREST.
ALTER TABLE public.chat_sessions
  ADD CONSTRAINT chat_sessions_id_user_id_key UNIQUE (id, user_id);

ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_session_id_fkey;

ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_session_owner_fkey
  FOREIGN KEY (session_id, user_id)
  REFERENCES public.chat_sessions(id, user_id)
  ON DELETE CASCADE;
