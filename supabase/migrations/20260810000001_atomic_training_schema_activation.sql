-- Enforce exactly-at-most-one active training schema per user and switch the
-- active row inside one PostgreSQL transaction. The advisory lock serializes
-- concurrent chat/block-review switches for the same user.

DO $$
DECLARE
  conflicting_users text;
BEGIN
  SELECT string_agg(user_id::text || ' (' || active_count || ' active)', ', ')
  INTO conflicting_users
  FROM (
    SELECT user_id, count(*) AS active_count
    FROM public.training_schemas
    WHERE is_active IS TRUE
    GROUP BY user_id
    HAVING count(*) > 1
  ) conflicts;

  IF conflicting_users IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot enforce one active training schema: %', conflicting_users
      USING HINT = 'Resolve duplicate active schemas before rerunning this migration.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX training_schemas_one_active_per_user_idx
  ON public.training_schemas (user_id)
  WHERE is_active IS TRUE;

CREATE OR REPLACE FUNCTION public.activate_training_schema(
  p_user_id uuid,
  p_new_schema_id uuid,
  p_previous_schema_id uuid DEFAULT NULL,
  p_previous_end_date date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  activated_rows integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  IF NOT EXISTS (
    SELECT 1
    FROM public.training_schemas
    WHERE id = p_new_schema_id
      AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Training schema % does not belong to user %',
      p_new_schema_id,
      p_user_id;
  END IF;

  UPDATE public.training_schemas
  SET
    is_active = false,
    end_date = CASE
      WHEN id = p_previous_schema_id AND p_previous_end_date IS NOT NULL
        THEN p_previous_end_date
      ELSE end_date
    END
  WHERE user_id = p_user_id
    AND is_active IS TRUE
    AND id <> p_new_schema_id;

  UPDATE public.training_schemas
  SET is_active = true
  WHERE id = p_new_schema_id
    AND user_id = p_user_id;

  GET DIAGNOSTICS activated_rows = ROW_COUNT;
  IF activated_rows <> 1 THEN
    RAISE EXCEPTION 'Training schema % could not be activated', p_new_schema_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_training_schema(uuid, uuid, uuid, date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_training_schema(uuid, uuid, uuid, date)
  TO service_role;
