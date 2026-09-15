-- Return the durable row, not only its id. On a retried chat turn this lets the
-- response/card reflect the first committed values instead of a second AI
-- estimate that the idempotency guard correctly discarded.
DROP FUNCTION public.save_nutrition_log_atomic(uuid, jsonb);

CREATE FUNCTION public.save_nutrition_log_atomic(p_user_id uuid, p_log jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  saved public.nutrition_logs%ROWTYPE;
  log_date date := (p_log->>'date')::date;
  source_turn uuid := NULLIF(p_log->>'source_chat_turn_id','')::uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('nutrition:'||p_user_id::text||':'||log_date::text,0));
  IF source_turn IS NOT NULL THEN
    SELECT * INTO saved FROM public.nutrition_logs
    WHERE user_id=p_user_id AND source_chat_turn_id=source_turn;
    IF FOUND THEN RETURN to_jsonb(saved); END IF;
  END IF;
  INSERT INTO public.nutrition_logs(user_id,date,raw_input,estimated_calories,estimated_protein_g,
    estimated_carbs_g,estimated_fat_g,estimated_fiber_g,meal_type,confidence,ai_analysis,source_chat_turn_id)
  VALUES (p_user_id,log_date,p_log->>'raw_input',(p_log->>'estimated_calories')::numeric,
    (p_log->>'estimated_protein_g')::numeric,(p_log->>'estimated_carbs_g')::numeric,
    (p_log->>'estimated_fat_g')::numeric,(p_log->>'estimated_fiber_g')::numeric,
    p_log->>'meal_type',p_log->>'confidence',p_log->>'ai_analysis',source_turn)
  RETURNING * INTO saved;
  PERFORM public.recompute_nutrition_summary_locked(p_user_id,log_date);
  RETURN to_jsonb(saved);
END; $$;

REVOKE ALL ON FUNCTION public.save_nutrition_log_atomic(uuid,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_nutrition_log_atomic(uuid,jsonb) TO service_role;
