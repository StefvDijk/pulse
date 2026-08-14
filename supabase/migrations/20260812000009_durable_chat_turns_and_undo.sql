-- Make an entire retried chat turn durable and idempotent: messages are unique
-- per turn+role, schema mutations are replay-safe, and nutrition save/undo
-- recomputes its derived summary in the same transaction.

ALTER TABLE public.chat_messages ADD COLUMN source_chat_turn_id uuid;
CREATE UNIQUE INDEX chat_messages_user_turn_role_key
  ON public.chat_messages(user_id, source_chat_turn_id, role);

ALTER TABLE public.training_schemas ADD COLUMN source_chat_turn_id uuid;
CREATE UNIQUE INDEX training_schemas_user_turn_key
  ON public.training_schemas(user_id, source_chat_turn_id);

CREATE TABLE public.chat_writeback_operations (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  turn_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('schema_update')),
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, turn_id, kind)
);
ALTER TABLE public.chat_writeback_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages chat writeback operations"
  ON public.chat_writeback_operations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.insert_and_activate_training_schema(
  p_user_id uuid,
  p_schema jsonb,
  p_previous_schema_id uuid DEFAULT NULL,
  p_previous_end_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_schema_id uuid;
  source_turn uuid := NULLIF(p_schema->>'source_chat_turn_id', '')::uuid;
BEGIN
  IF jsonb_typeof(p_schema) <> 'object'
    OR p_schema->>'user_id' IS DISTINCT FROM p_user_id::text THEN
    RAISE EXCEPTION 'Training schema identity does not match RPC user';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  IF source_turn IS NOT NULL THEN
    SELECT id INTO new_schema_id
    FROM public.training_schemas
    WHERE user_id = p_user_id AND source_chat_turn_id = source_turn;
    IF FOUND THEN RETURN new_schema_id; END IF;
  END IF;

  INSERT INTO public.training_schemas (
    user_id, title, schema_type, weeks_planned, start_date, workout_schedule,
    progression_rules, quality_audit, planned_weekly_load,
    source_block_review_id, source_chat_turn_id, is_active, ai_generated,
    generation_context
  ) VALUES (
    p_user_id, p_schema->>'title', p_schema->>'schema_type',
    COALESCE((p_schema->>'weeks_planned')::integer, 4),
    (p_schema->>'start_date')::date, p_schema->'workout_schedule',
    COALESCE(p_schema->'progression_rules', '{}'::jsonb),
    COALESCE(p_schema->'quality_audit', '{}'::jsonb),
    COALESCE(p_schema->'planned_weekly_load', '{}'::jsonb),
    (p_schema->>'source_block_review_id')::uuid, source_turn, false,
    COALESCE((p_schema->>'ai_generated')::boolean, true),
    p_schema->>'generation_context'
  ) RETURNING id INTO new_schema_id;

  PERFORM public.activate_training_schema(
    p_user_id, new_schema_id, p_previous_schema_id, p_previous_end_date
  );
  RETURN new_schema_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_chat_schema_update_once(
  p_user_id uuid,
  p_turn_id uuid,
  p_schema_id uuid,
  p_expected_schedule jsonb,
  p_updated_schedule jsonb,
  p_description text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE existing_result jsonb; current_schedule jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('chat-schema:' || p_user_id::text, 0));
  SELECT result INTO existing_result FROM public.chat_writeback_operations
  WHERE user_id = p_user_id AND turn_id = p_turn_id AND kind = 'schema_update';
  IF FOUND THEN RETURN existing_result || '{"replayed":true}'::jsonb; END IF;

  SELECT workout_schedule INTO current_schedule FROM public.training_schemas
  WHERE id = p_schema_id AND user_id = p_user_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"applied":false,"description":"Actief schema niet gevonden."}'::jsonb; END IF;
  IF current_schedule IS DISTINCT FROM p_expected_schedule THEN
    RETURN '{"applied":false,"description":"Schema is intussen gewijzigd; probeer opnieuw."}'::jsonb;
  END IF;

  UPDATE public.training_schemas SET workout_schedule = p_updated_schedule
  WHERE id = p_schema_id AND user_id = p_user_id;
  existing_result := jsonb_build_object('applied', true, 'description', p_description, 'replayed', false);
  INSERT INTO public.chat_writeback_operations(user_id, turn_id, kind, result)
  VALUES (p_user_id, p_turn_id, 'schema_update', existing_result);
  RETURN existing_result;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_chat_schema_update_once(uuid,uuid,uuid,jsonb,jsonb,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_chat_schema_update_once(uuid,uuid,uuid,jsonb,jsonb,text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.recompute_nutrition_summary_locked(p_user_id uuid, p_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE calories numeric; protein numeric; carbs numeric; fat numeric; fiber numeric;
BEGIN
  SELECT COALESCE(round(sum(estimated_calories)),0),
    COALESCE(round(sum(estimated_protein_g)::numeric,1),0),
    COALESCE(round(sum(estimated_carbs_g)::numeric,1),0),
    COALESCE(round(sum(estimated_fat_g)::numeric,1),0),
    COALESCE(round(sum(estimated_fiber_g)::numeric,1),0)
  INTO calories,protein,carbs,fat,fiber FROM public.nutrition_logs WHERE user_id=p_user_id AND date=p_date;
  INSERT INTO public.daily_nutrition_summary(
    user_id,date,total_calories,total_protein_g,total_carbs_g,total_fat_g,total_fiber_g
  ) VALUES (p_user_id,p_date,calories,protein,carbs,fat,fiber)
  ON CONFLICT (user_id,date) DO UPDATE SET
    total_calories=EXCLUDED.total_calories,total_protein_g=EXCLUDED.total_protein_g,
    total_carbs_g=EXCLUDED.total_carbs_g,total_fat_g=EXCLUDED.total_fat_g,
    total_fiber_g=EXCLUDED.total_fiber_g;
END; $$;

CREATE OR REPLACE FUNCTION public.save_nutrition_log_atomic(p_user_id uuid, p_log jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE log_id uuid; log_date date := (p_log->>'date')::date; source_turn uuid := NULLIF(p_log->>'source_chat_turn_id','')::uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('nutrition:'||p_user_id::text||':'||log_date::text,0));
  IF source_turn IS NOT NULL THEN
    SELECT id INTO log_id FROM public.nutrition_logs WHERE user_id=p_user_id AND source_chat_turn_id=source_turn;
    IF FOUND THEN RETURN log_id; END IF;
  END IF;
  INSERT INTO public.nutrition_logs(user_id,date,raw_input,estimated_calories,estimated_protein_g,
    estimated_carbs_g,estimated_fat_g,estimated_fiber_g,meal_type,confidence,ai_analysis,source_chat_turn_id)
  VALUES (p_user_id,log_date,p_log->>'raw_input',(p_log->>'estimated_calories')::numeric,
    (p_log->>'estimated_protein_g')::numeric,(p_log->>'estimated_carbs_g')::numeric,
    (p_log->>'estimated_fat_g')::numeric,(p_log->>'estimated_fiber_g')::numeric,
    p_log->>'meal_type',p_log->>'confidence',p_log->>'ai_analysis',source_turn)
  RETURNING id INTO log_id;
  PERFORM public.recompute_nutrition_summary_locked(p_user_id,log_date);
  RETURN log_id;
END; $$;

CREATE OR REPLACE FUNCTION public.undo_chat_nutrition_log(p_user_id uuid, p_log_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE log_date date;
BEGIN
  SELECT date INTO log_date FROM public.nutrition_logs WHERE id=p_log_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nutrition log not found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('nutrition:'||p_user_id::text||':'||log_date::text,0));
  DELETE FROM public.nutrition_logs WHERE id=p_log_id AND user_id=p_user_id;
  PERFORM public.recompute_nutrition_summary_locked(p_user_id,log_date);
  UPDATE public.chat_messages m SET cards = (
    SELECT COALESCE(jsonb_agg(CASE
      WHEN c->>'type'='writeback_card' AND c->>'record_id'=p_log_id::text
      THEN c || '{"status":"undone"}'::jsonb ELSE c END), '[]'::jsonb)
    FROM jsonb_array_elements(m.cards) c
  ) WHERE m.user_id=p_user_id AND m.cards @> jsonb_build_array(jsonb_build_object('record_id',p_log_id::text));
END; $$;

REVOKE ALL ON FUNCTION public.save_nutrition_log_atomic(uuid,jsonb),
  public.undo_chat_nutrition_log(uuid,uuid),
  public.recompute_nutrition_summary_locked(uuid,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_nutrition_log_atomic(uuid,jsonb),
  public.undo_chat_nutrition_log(uuid,uuid) TO service_role;
