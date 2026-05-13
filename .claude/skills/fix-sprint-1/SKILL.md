---
name: fix-sprint-1
description: Sprint 1 — Foundation. Veilig + meetbaar maken. P0 security fixes + tooling (eval-harness). 8 fixes, geen dependencies. Vereist voor alle volgende sprints.
---

# Sprint 1 — Foundation

**Doel:** veilig zetten en meetbaar maken. Hierna kun je risicovollere fixes doen omdat je weet wanneer je iets breekt.

**Fix-IDs in deze sprint:**

| ID | Titel | Agent | PR-strategy |
|----|-------|-------|-------------|
| A3 | Next.js update (6 HIGH CVEs) | fix-implementer | Solo PR (kan breaking changes hebben) |
| A1 | XSS sanitize chat | fix-implementer | Combineer met PR diff 003 |
| A2 | /api/admin/seed-memory auth | fix-implementer | Combineer met andere A's |
| A8 | PHI uit Apple Health logs | fix-implementer | Combineer met andere A's |
| A9 | Debug response cleanup | fix-implementer | Combineer met andere A's |
| C1 | Check-in week-calc | fix-implementer + test-author | Solo PR (combineer met D2) |
| D2 | getISOWeekNumber centraliseren | fix-implementer | Combineer met C1 |
| B1 | AI eval-harness | ai-refactorer | Solo PR (combineer met diff 002) |

**Out of scope deze sprint** (en überhaupt geschrapt):
- ~~G1 (Sentry): geschrapt op user-verzoek.~~
- ~~G3 (Supabase Pro): geschrapt op user-verzoek.~~
- ~~A4 (Vault encryption): geschrapt (afhankelijk van G3).~~
- A5 (server.ts splitsen): groot, komt in sprint 4.

## Parallelle uitvoering

**Groep 1 (parallel — onafhankelijke files):**
- A3 (package.json + lockfile)
- A8 (apple-health/route.ts regels 155-166)
- A9 (apple-health/route.ts regels 541-545)
- D11 (delete src/proxy.ts) ← LIFT FROM SPRINT 2 want gratis
- E3 (layout.tsx themeColor) ← LIFT FROM SPRINT 2 want 1 regel

**Groep 2 (na groep 1):**
- A1 (combineer met PR 003 die al klaarstaat)
- A2 (admin/seed-memory route)

**Specialist (serieel):**
- C1 + D2 → fix-implementer met test-author backup. Test eerst, fix dan, test groen.
- B1 (eval-harness, combineer met PR 002) → ai-refactorer

## Acceptance criteria (sprint 1)

Aan het einde moet gelden:
1. `pnpm typecheck` groen
2. `pnpm lint` ≤ baseline error-count
3. `pnpm audit --severity high` 0 high vulns
4. `git log --oneline audit-fixes-2026-05..HEAD` toont ≥ 8 commits met fix-IDs
5. `scripts/eval-ai.ts` of `scripts/eval-ai/cases.ts` bestaat met ≥ 30 testcases
6. `pnpm eval:ai` runt zonder errors en geeft een score
7. `tests/unit/check-in-week.test.ts` (of vergelijkbare path) bestaat en is groen (≥ 5 testcases incl. DST)
8. `.claude/audit-output/sprint-1-report.md` bestaat met PR-body

## Stop-condities

STOP en escaleer naar user als:
- A3 (Next.js update) breekt > 5 files na update. Mogelijk major-version migration nodig.
- C1 fix faalt op DST-cases (29 maart of 25 oktober 2026). Vraag user om de test te bekijken.

## Output

- Sprint-1 PR-body in `.claude/audit-output/sprint-1-report.md`
- Lijst van fix-IDs voltooid
- Eval-harness baseline-score
