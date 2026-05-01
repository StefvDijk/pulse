-- Migration: coaching_memory confidence + supersession
-- Adds the fields needed for time-decay and conflict-resolution per
-- the Memoria/PH-LLM pattern. Existing rows default to confidence=1.0.

ALTER TABLE public.coaching_memory
  ADD COLUMN IF NOT EXISTS confidence FLOAT NOT NULL DEFAULT 1.0
    CHECK (confidence >= 0 AND confidence <= 1),
  ADD COLUMN IF NOT EXISTS last_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES public.coaching_memory(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.coaching_memory.confidence
  IS 'Decays by 0.2 each check-in cycle if not confirmed; filtered out below 0.3';
COMMENT ON COLUMN public.coaching_memory.last_confirmed_at
  IS 'Bumped whenever the AI references the fact or user confirms it';
COMMENT ON COLUMN public.coaching_memory.superseded_by
  IS 'When non-null, this fact has been replaced by a newer one';

CREATE INDEX IF NOT EXISTS coaching_memory_active_idx
  ON public.coaching_memory (user_id, confidence)
  WHERE superseded_by IS NULL;
