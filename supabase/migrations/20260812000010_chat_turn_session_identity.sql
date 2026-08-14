-- A first-turn retry may arrive before the client learned its session id.
-- Resolve it back to the original session, and distinguish opening nudges from
-- the terminal assistant response within the same turn.
ALTER TABLE public.chat_sessions ADD COLUMN initial_turn_id uuid;
CREATE UNIQUE INDEX chat_sessions_user_initial_turn_key
  ON public.chat_sessions(user_id, initial_turn_id);

CREATE OR REPLACE FUNCTION public.resolve_chat_session_for_turn(
  p_user_id uuid, p_turn_id uuid, p_coach_id text, p_title text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE resolved public.chat_sessions%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('chat-turn:'||p_user_id::text||':'||p_turn_id::text,0));
  SELECT * INTO resolved FROM public.chat_sessions
  WHERE user_id=p_user_id AND initial_turn_id=p_turn_id;
  IF NOT FOUND THEN
    INSERT INTO public.chat_sessions(user_id,coach_id,title,started_at,last_message_at,initial_turn_id)
    VALUES (p_user_id,p_coach_id,left(p_title,50),now(),now(),p_turn_id)
    RETURNING * INTO resolved;
  END IF;
  RETURN jsonb_build_object('id',resolved.id,'coach_id',resolved.coach_id);
END; $$;
REVOKE ALL ON FUNCTION public.resolve_chat_session_for_turn(uuid,uuid,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_chat_session_for_turn(uuid,uuid,text,text) TO service_role;

DROP INDEX public.chat_messages_user_turn_role_key;
CREATE UNIQUE INDEX chat_messages_user_turn_part_key
  ON public.chat_messages(user_id, source_chat_turn_id, role, message_type);

REVOKE ALL ON FUNCTION public.recompute_nutrition_summary_locked(uuid,date)
  FROM PUBLIC, anon, authenticated;
