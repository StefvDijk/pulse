-- coaching_memory: persistent AI coach memory per user
-- Each row = one fact the coach knows about this user.
-- Key is unique per user — upserting the same key overwrites the previous value.

CREATE TABLE public.coaching_memory (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key          text        NOT NULL,
  category     text        NOT NULL
                           CHECK (category IN ('program', 'lifestyle', 'injury', 'preference', 'pattern', 'goal')),
  value        text        NOT NULL,
  source_date  date        NOT NULL DEFAULT CURRENT_DATE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, key)
);

CREATE INDEX coaching_memory_user_idx ON public.coaching_memory (user_id);

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER coaching_memory_updated_at
  BEFORE UPDATE ON public.coaching_memory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: users can read their own memories; service role manages all
ALTER TABLE public.coaching_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_memories"
  ON public.coaching_memory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "service_role_all_memories"
  ON public.coaching_memory FOR ALL
  USING (true);
