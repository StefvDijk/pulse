-- Serialize one logical chat turn before any provider call or write-back. The
-- durable fingerprint prevents a client from reusing a turn id for different
-- content, while the lease allows recovery after a killed serverless worker.
CREATE TABLE public.chat_turn_executions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  turn_id uuid NOT NULL,
  session_id uuid NOT NULL,
  request_fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed')),
  lease_token uuid,
  lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, turn_id),
  FOREIGN KEY (session_id, user_id)
    REFERENCES public.chat_sessions(id, user_id) ON DELETE CASCADE
);

ALTER TABLE public.chat_turn_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages chat turn executions"
  ON public.chat_turn_executions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE FUNCTION public.claim_chat_turn(
  p_user_id uuid,
  p_turn_id uuid,
  p_session_id uuid,
  p_request_fingerprint text,
  p_lease_seconds integer DEFAULT 90
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  execution public.chat_turn_executions%ROWTYPE;
  next_token uuid := gen_random_uuid();
  retry_after_ms integer;
BEGIN
  IF p_lease_seconds < 30 OR p_lease_seconds > 300 OR length(p_request_fingerprint) <> 64 THEN
    RAISE EXCEPTION 'Invalid chat turn claim';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('chat-turn-claim:'||p_user_id::text||':'||p_turn_id::text,0));
  SELECT * INTO execution FROM public.chat_turn_executions
  WHERE user_id=p_user_id AND turn_id=p_turn_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.chat_turn_executions(
      user_id,turn_id,session_id,request_fingerprint,status,lease_token,lease_expires_at
    ) VALUES (
      p_user_id,p_turn_id,p_session_id,p_request_fingerprint,'processing',next_token,
      now()+make_interval(secs=>p_lease_seconds)
    );
    RETURN jsonb_build_object('claimed',true,'completed',false,'lease_token',next_token,'retry_after_ms',0);
  END IF;

  IF execution.session_id IS DISTINCT FROM p_session_id
    OR execution.request_fingerprint IS DISTINCT FROM p_request_fingerprint THEN
    RAISE EXCEPTION 'Chat turn identity does not match original request';
  END IF;
  IF execution.status='completed' THEN
    RETURN jsonb_build_object('claimed',false,'completed',true,'lease_token',NULL,'retry_after_ms',0);
  END IF;
  IF execution.status='processing' AND execution.lease_expires_at > now() THEN
    retry_after_ms := greatest(1,ceil(extract(epoch FROM (execution.lease_expires_at-now()))*1000)::integer);
    RETURN jsonb_build_object('claimed',false,'completed',false,'lease_token',NULL,'retry_after_ms',retry_after_ms);
  END IF;

  UPDATE public.chat_turn_executions SET
    status='processing',lease_token=next_token,
    lease_expires_at=now()+make_interval(secs=>p_lease_seconds),updated_at=now()
  WHERE user_id=p_user_id AND turn_id=p_turn_id;
  RETURN jsonb_build_object('claimed',true,'completed',false,'lease_token',next_token,'retry_after_ms',0);
END; $$;

CREATE FUNCTION public.complete_chat_turn(
  p_user_id uuid,p_turn_id uuid,p_lease_token uuid
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  UPDATE public.chat_turn_executions SET
    status='completed',lease_token=NULL,lease_expires_at=NULL,updated_at=now()
  WHERE user_id=p_user_id AND turn_id=p_turn_id
    AND status='processing' AND lease_token=p_lease_token;
  RETURN FOUND;
END; $$;

CREATE FUNCTION public.abandon_chat_turn(
  p_user_id uuid,p_turn_id uuid,p_lease_token uuid
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  UPDATE public.chat_turn_executions SET
    status='pending',lease_token=NULL,lease_expires_at=NULL,updated_at=now()
  WHERE user_id=p_user_id AND turn_id=p_turn_id
    AND status='processing' AND lease_token=p_lease_token;
  RETURN FOUND;
END; $$;

REVOKE ALL ON FUNCTION public.claim_chat_turn(uuid,uuid,uuid,text,integer),
  public.complete_chat_turn(uuid,uuid,uuid), public.abandon_chat_turn(uuid,uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_chat_turn(uuid,uuid,uuid,text,integer),
  public.complete_chat_turn(uuid,uuid,uuid), public.abandon_chat_turn(uuid,uuid,uuid)
  TO service_role;
