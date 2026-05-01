-- Add coach_tone column to user_settings
-- Selects which voice/tone variant the AI coach uses in system prompt
ALTER TABLE public.user_settings
ADD COLUMN coach_tone text NOT NULL DEFAULT 'direct'
CHECK (coach_tone IN ('direct', 'friendly', 'scientific'));
