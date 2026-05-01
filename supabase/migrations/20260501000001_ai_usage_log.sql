-- Migration: ai_usage_log — track every Claude API call so we can answer
-- "where do my Anthropic tokens go?" without guessing. One row per call.
-- Read-mostly; we expect ≪1 row/sec, so no partitioning needed yet.

CREATE TABLE ai_usage_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Logical surface that fired the call. Free-form so adding new
  -- features doesn't require a migration. Examples: 'chat', 'explain',
  -- 'nutrition', 'memory_extractor', 'sport_insight', 'weekly_lessons',
  -- 'check_in_plan', 'sync_analyst', 'health_ai', 'chat_suggestions'.
  feature TEXT NOT NULL,
  -- Anthropic model slug as sent to the API.
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  -- Cache reads/writes when prompt-caching is in play (Anthropic returns
  -- these in the usage object). Keep nullable for callers that don't
  -- pass them.
  cache_read_tokens INTEGER,
  cache_creation_tokens INTEGER,
  -- Wall-clock latency from request send to first/last token.
  duration_ms INTEGER,
  -- Did the call succeed? On error we still want a row so failures show
  -- up in the dashboard.
  status TEXT NOT NULL DEFAULT 'ok',
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_log_created_at ON ai_usage_log(created_at DESC);
CREATE INDEX idx_ai_usage_log_user_created ON ai_usage_log(user_id, created_at DESC);
CREATE INDEX idx_ai_usage_log_feature_created ON ai_usage_log(feature, created_at DESC);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage rows (for an in-app "your usage" view later).
CREATE POLICY "Users read own ai usage"
  ON ai_usage_log FOR SELECT
  USING (auth.uid() = user_id);

-- Only the service role writes.
CREATE POLICY "Service role full access to ai_usage_log"
  ON ai_usage_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
