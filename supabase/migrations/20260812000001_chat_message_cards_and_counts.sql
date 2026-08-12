-- Persist rich chat cards and keep session metrics derived from actual messages.
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS cards JSONB NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(cards) = 'array');

CREATE OR REPLACE FUNCTION public.refresh_chat_session_metrics(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_session_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.chat_sessions AS session
  SET
    message_count = metrics.message_count,
    last_message_at = metrics.last_message_at
  FROM (
    SELECT COUNT(*)::INTEGER AS message_count, MAX(created_at) AS last_message_at
    FROM public.chat_messages
    WHERE session_id = p_session_id
  ) AS metrics
  WHERE session.id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_chat_message_metrics_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.session_id IS DISTINCT FROM NEW.session_id THEN
    PERFORM public.refresh_chat_session_metrics(OLD.session_id);
  END IF;

  PERFORM public.refresh_chat_session_metrics(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.session_id ELSE NEW.session_id END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS chat_message_metrics_changed ON public.chat_messages;
CREATE TRIGGER chat_message_metrics_changed
AFTER INSERT OR DELETE OR UPDATE OF session_id, created_at
ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.on_chat_message_metrics_changed();

UPDATE public.chat_sessions AS session
SET
  message_count = metrics.message_count,
  last_message_at = metrics.last_message_at
FROM (
  SELECT
    chat_sessions.id,
    COUNT(chat_messages.id)::INTEGER AS message_count,
    MAX(chat_messages.created_at) AS last_message_at
  FROM public.chat_sessions
  LEFT JOIN public.chat_messages ON chat_messages.session_id = chat_sessions.id
  GROUP BY chat_sessions.id
) AS metrics
WHERE session.id = metrics.id;
