-- Persist the completed model output before applying any write-back. If a
-- worker dies after a mutation but before the assistant message, the next
-- lease owner resumes the exact same intent instead of asking the model again.
ALTER TABLE public.chat_turn_executions
  ADD COLUMN generated_response text;

CREATE FUNCTION public.store_chat_turn_response(
  p_user_id uuid,p_turn_id uuid,p_lease_token uuid,p_generated_response text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF length(p_generated_response) = 0 THEN
    RAISE EXCEPTION 'Generated chat response cannot be empty';
  END IF;
  UPDATE public.chat_turn_executions SET
    generated_response=COALESCE(generated_response,p_generated_response),updated_at=now()
  WHERE user_id=p_user_id AND turn_id=p_turn_id
    AND status='processing' AND lease_token=p_lease_token;
  RETURN FOUND;
END; $$;

REVOKE ALL ON FUNCTION public.store_chat_turn_response(uuid,uuid,uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.store_chat_turn_response(uuid,uuid,uuid,text)
  TO service_role;
