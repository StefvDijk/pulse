-- Keep schema-generation's old-block summary in the same transaction as the
-- insert/activation, and keep chat schema-update memory in the update ledger's
-- transaction. A successful write-back can no longer lose these side effects.
CREATE OR REPLACE FUNCTION public.write_schema_block_summary_atomic(
  p_user_id uuid,p_schema_id uuid,p_end_reason text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  old_schema public.training_schemas%ROWTYPE;
  block_end date;
  planned integer;
  completed integer;
  adherence numeric;
  exercise_titles text[];
BEGIN
  SELECT * INTO old_schema FROM public.training_schemas
  WHERE id=p_schema_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Previous training schema not found'; END IF;

  block_end := old_schema.start_date + (COALESCE(old_schema.weeks_planned,8)*7-1);
  planned := CASE WHEN jsonb_typeof(old_schema.workout_schedule)='array'
    THEN jsonb_array_length(old_schema.workout_schedule)*COALESCE(old_schema.weeks_planned,8)
    ELSE 0 END;
  SELECT
    (SELECT count(*) FROM public.workouts WHERE user_id=p_user_id
      AND started_at >= old_schema.start_date::timestamp AT TIME ZONE 'UTC'
      AND started_at < (block_end+1)::timestamp AT TIME ZONE 'UTC')
    +(SELECT count(*) FROM public.runs WHERE user_id=p_user_id
      AND started_at >= old_schema.start_date::timestamp AT TIME ZONE 'UTC'
      AND started_at < (block_end+1)::timestamp AT TIME ZONE 'UTC')
    +(SELECT count(*) FROM public.padel_sessions WHERE user_id=p_user_id
      AND started_at >= old_schema.start_date::timestamp AT TIME ZONE 'UTC'
      AND started_at < (block_end+1)::timestamp AT TIME ZONE 'UTC')
  INTO completed;
  adherence := CASE WHEN planned>0 THEN round(completed::numeric/planned*100,1) ELSE NULL END;
  SELECT COALESCE(array_agg(title),ARRAY[]::text[]) INTO exercise_titles FROM (
    SELECT DISTINCT trim(title) AS title FROM public.workouts
    WHERE user_id=p_user_id AND trim(COALESCE(title,''))<>''
      AND started_at >= old_schema.start_date::timestamp AT TIME ZONE 'UTC'
      AND started_at < (block_end+1)::timestamp AT TIME ZONE 'UTC'
    LIMIT 50
  ) used;

  INSERT INTO public.schema_block_summaries(
    user_id,schema_id,summary,exercises_used,adherence_percentage,
    total_sessions_planned,total_sessions_completed,end_reason
  ) VALUES (
    p_user_id,p_schema_id,
    format('Blok "%s": %s/%s sessies (%s%% adherence) over %s weken. Reden: %s.',
      old_schema.title,completed,planned,COALESCE(adherence::text,'?'),
      COALESCE(old_schema.weeks_planned,8),p_end_reason),
    exercise_titles,adherence,planned,completed,p_end_reason
  );
  UPDATE public.training_schemas SET end_date=block_end WHERE id=p_schema_id;
END; $$;

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
  IF source_turn IS NOT NULL AND p_previous_schema_id IS NOT NULL THEN
    PERFORM public.write_schema_block_summary_atomic(p_user_id,p_previous_schema_id,'switched');
  END IF;
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
  INSERT INTO public.coaching_memory(user_id,key,category,value)
  VALUES (
    p_user_id,
    'ai_schema_update_'||((now() AT TIME ZONE 'Europe/Amsterdam')::date)::text,
    'program','Coach heeft het schema aangepast: '||p_description
  ) ON CONFLICT (user_id,key) DO UPDATE SET value=EXCLUDED.value,category=EXCLUDED.category;
  existing_result := jsonb_build_object('applied', true, 'description', p_description, 'replayed', false);
  INSERT INTO public.chat_writeback_operations(user_id, turn_id, kind, result)
  VALUES (p_user_id, p_turn_id, 'schema_update', existing_result);
  RETURN existing_result;
END;
$$;

REVOKE ALL ON FUNCTION public.write_schema_block_summary_atomic(uuid,uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.write_schema_block_summary_atomic(uuid,uuid,text)
  TO service_role;
