-- Add ai_custom_instructions column to user_settings
-- Free-text field for user-provided instructions injected into the AI system prompt
ALTER TABLE public.user_settings
ADD COLUMN ai_custom_instructions text;
