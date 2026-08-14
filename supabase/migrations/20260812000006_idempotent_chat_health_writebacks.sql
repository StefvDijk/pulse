-- A retried chat turn must not duplicate committed health-data mutations when
-- the stream or assistant-message persistence fails after the write-back.
ALTER TABLE public.nutrition_logs
  ADD COLUMN source_chat_turn_id uuid;
CREATE UNIQUE INDEX nutrition_logs_source_chat_turn_id_key
  ON public.nutrition_logs(source_chat_turn_id);

ALTER TABLE public.injury_logs
  ADD COLUMN source_chat_turn_id uuid;
CREATE UNIQUE INDEX injury_logs_source_chat_turn_id_key
  ON public.injury_logs(source_chat_turn_id);
