# AI layer changelog

Tracks meaningful changes to `src/lib/ai/*` and AI-related routes. Append at top.

## 2026-05-13 — Sprint 3 PR4: context refactor

- **B4**: context-assembler.ts shrunk 990 → 108 lines. Removed `assembleContext`
  + 7 type-specific builders + formatter helpers that nothing imported.
  Only `assembleThinContext` (used by chat/route + ai-context-preview) and
  re-export of `classifyQuestion` remain.
- **B6**: weekly-summary.ts trimmed to pure format-guidance (data variables
  removed; data now flows via tools). checkin-analyze.ts keeps its
  JSON-output contract for the check-in API. Two prompts coexist by design
  — different consumers, but the data-source is shared via tools.
- **B8**: new `history-compressor.ts` summarizes oldest turns when chat
  history > 16; keeps last 6 verbatim. Uses MEMORY_MODEL (Haiku) for the
  summary. Fail-safe falls back to tail-slice on Haiku error.
- **B11**: chat-system.ts sections 9 (PROGRESSIE-TRACKING) and 10
  (LICHAAMSCOMPOSITIE) dropped the static data tables. Both now point the
  agent at the new tools (`get_exercise_stats`, `get_body_composition`).
  Coach context (motivation patterns, blessure-protocols, geleerde lessen)
  stays static — those are not data, they're domain knowledge.

## 2026-05-13 — Sprint 3 PR3: read tools [B7]

Added 4 read tools in `src/lib/ai/tools/handlers/profile-tools.ts`:
- `get_body_composition` — latest entry + trend
- `get_active_schema` — full active schema row
- `get_injury_history` — active (+ optional resolved) injury_logs
- `get_weekly_aggregations` — N most-recent week rows

Foundation for B11 — agent can now answer "hoe gaat mijn vetpercentage?"
with fresh DB data instead of guessing from the static system prompt.

## 2026-05-13 — Sprint 3 PR2: write-back via tools [B3 + A11 + D4]

Replaced XML write-paths with AI SDK tools (Zod inputSchema):
- `log_nutrition`, `log_injury`, `propose_schema_generation`,
  `propose_schema_update` — in `src/lib/ai/tools/writebacks.ts`
- `extractWritebacks` and the 4 silent JSON.parse catches deleted.
- Schema-generation skill prompt updated to call the tool, not write XML.
- chat-system.ts \"Write-back instructies\" replaced with tool descriptions.

Anthropic's tool-use protocol now structurally enforces payload shape;
prompt-injected fake-tags are no longer possible.

## 2026-05-13 — Sprint 3 PR1: classifier rewrite [B2]

Substring matching (`.includes()`) → word-PREFIX boundary (`\\b<kw>`).
Body parts (knie, rug, schouder) stay substring-matched to handle Dutch
compounds (linkerknie, rugpijn). Removed ambiguous keywords: 'at', 'eet',
'dag'. Added 'rdl' / 'sdl' for lift abbreviations.

Eval-harness: 22/30 (73.3%) → 39/39 (100%) across 9 added edge cases.
Unit tests in `tests/classifier.test.ts` (12 assertions).

## 2026-05-12 — Sprint 2 group B [B5 + B9 + B10 + B12]

- B5: loadCoachingMemory cap @30
- B9: try/catch around result.usage
- B10: memory-extractor inner catches now log with [memory-extractor] tag
- B12: chat-system prompt gained "ANTWOORDLENGTE & STIJL" section
