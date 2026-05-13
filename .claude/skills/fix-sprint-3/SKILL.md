---
name: fix-sprint-3
description: Sprint 3 — AI-laag refactor. 12 fixes om vertrouwen in de AI-coach te herstellen. Vereist B1 (eval-harness) uit sprint 1. Alle B-fixes gaan door ai-refactorer subagent.
---

# Sprint 3 — AI-Laag

**Doel:** je krijgt eindelijk vertrouwen in de AI-coach. Eval-harness uit sprint 1 is je meetstok.

**Vereiste vóór start:** `pnpm eval:ai` runt en geeft een baseline-score. Sla die op in `.claude/audit-output/eval-baseline.txt`.

**Fix-IDs (4 PRs):**

### PR 1 — Classifier + edge cases (B2, eigen PR)
Standalone. Regex-volgorde fixen, edge cases uit fase 2 sectie 3.1.
+ Voeg ≥ 10 nieuwe eval-cases toe voor classifier edge cases.

### PR 2 — Write-back via tools (combo: B3 + A11 + D4)
De grote refactor. XML-write paden vervangen door echte AI SDK tools met Zod.
- `extractWritebacks` weg
- Nieuwe tools: `log_nutrition`, `log_injury`, `propose_schema`, `store_memory`
- Tool definitions in `src/lib/ai/tools/writebacks.ts`
- Stille catches: vervang door `console.error` met fix-ID + context (geen Sentry, dat is geschrapt)
+ Voeg eval-cases toe voor tool-routing edge cases.

### PR 3 — Read-tools uitbreiden (B7, eigen PR)
Nieuwe tools toevoegen:
- `get_body_composition`
- `get_active_schema`
- `get_injury_history`
- `get_weekly_aggregations`
+ Voeg eval-cases toe voor elk: "hoe gaat mijn vetpercentage?" etc.

### PR 4 — Context refactor (combo: B4 + B5 + B6 + B8 + B11 + B12)
- B4: 700+ regels dode code weg uit context-assembler
- B5: coaching memory limit (combineer met B4-cleanup)
- B6: één weekly-review prompt (kies markdown-versie, JSON-versie weg)
- B8: conversation history compressie met Haiku-summary
- B11: profiel uit prompt naar tools (raakt B7)
- B12: response-length policy

**Out of scope:**
- B9, B10 (al gedaan in sprint 2 groep B)

## Werkstroom per PR

1. Branch van `audit-fixes-2026-05`
2. Implementeer
3. `pnpm eval:ai` — score moet ≥ baseline blijven
4. Als score lager: revert, denk opnieuw. Niet doorduwen.
5. Test toevoegen indien testbaar (unit test op classifier, integration test op tool-call flow)
6. Commit met fix-IDs in message
7. `src/lib/ai/CHANGELOG.md` bijwerken
8. PR-body via `pr-author`

## Acceptance criteria

1. Typecheck + lint groen
2. 4 PRs gemaakt
3. `pnpm eval:ai` score ≥ baseline + 5 punten (we hebben tooling toegevoegd dus we moeten beter scoren)
4. `src/lib/ai/CHANGELOG.md` heeft 4 nieuwe entries
5. Geen XML-write parsing meer in `src/app/api/chat/route.ts`
6. Geen hardcoded profile-data in `src/lib/ai/prompts/chat-system.ts`

## Stop-condities

- Eval-score zakt > 3 punten t.o.v. baseline → revert laatste change en escaleer
- Een tool-call test faalt op de structured output → mogelijk Zod schema te streng, herzien
- B11 raakt > 200 regels code → splitsen, eigen sprint of split-PR
