-- Proactivity: deterministic, coach-scoped nudges (issue #42).
-- A nudge is created by a deterministic trigger evaluator (cron); the LLM only
-- writes the wording. dedupe_key keeps a recurring trigger from spamming.

CREATE TABLE nudges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    coach_id TEXT NOT NULL,                       -- owning coach: manager/sport/nutrition/health
    trigger_type TEXT NOT NULL,                   -- e.g. 'protein_below_target'
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
    body TEXT NOT NULL,                           -- the wording (LLM, deterministic fallback)
    cta_label TEXT,
    cta_href TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dismissed')),
    dedupe_key TEXT NOT NULL,                     -- one nudge per (user, dedupe_key)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dedup: a recurring trigger upserts on this key and never duplicates.
CREATE UNIQUE INDEX idx_nudges_dedupe ON nudges(user_id, dedupe_key);
-- Read path: a coach tab / the inbox fetches active nudges, newest first.
CREATE INDEX idx_nudges_user_coach ON nudges(user_id, coach_id, status, created_at DESC);

ALTER TABLE nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nudges_owner_all"
    ON nudges FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "nudges_service_role_all"
    ON nudges FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE nudges IS 'Deterministic coach-scoped nudges (issue #42). Trigger decides IF; LLM only writes the wording. dedupe_key prevents spam.';
