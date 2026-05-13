---
name: fix-pulse-sprint
description: Master orchestrator voor de Pulse audit-fixes. Voert sprint N uit van het 5-sprint plan. Roep deze skill aan met de sprint-nummer als argument om die sprint te runnen. Coördineert subagents, beheert worktrees, schrijft PR's.
---

# Pulse Fix-Sprint Orchestrator

Je krijgt een sprint-nummer (1-5) via `$ARGUMENTS`. Voer die sprint uit volgens `.claude/skills/fix-sprint-$ARGUMENTS/SKILL.md`.

## Algemene werkstroom (geldt voor elke sprint)

### Fase A — Setup (5 min)
1. Lees de sprint-skill voor deze sprint (`.claude/skills/fix-sprint-$ARGUMENTS/SKILL.md`).
2. Verifieer dat we op de juiste baseline-branch zitten: `git branch --show-current` moet `audit-fixes-2026-05` zijn. Anders: `git checkout audit-fixes-2026-05`.
3. Run `verifier` subagent voor een baseline-snapshot van typecheck/lint/tests.

### Fase B — Plan (10 min)
1. Lees ALLE fix-IDs in de sprint-skill.
2. Groepeer ze:
   - **Parallel-veilig**: fixes die geen overlappende files hebben. Delegeer naar `fix-implementer` subagent in parallel via Agent tool.
   - **Specialist-werk**: fixes die naar specifieke subagent moeten (security-engineer, ai-refactorer, db-migrator).
   - **Combos**: fixes die in 1 PR moeten (bv. B3 + A11 + D4).
3. Output: tabel met (fix-ID, agent, parallel-groep). Toon aan gebruiker voor goedkeuring vóór Fase C.

### Fase C — Execute (bulk werk)
1. Start parallel-groep 1: Agent-calls naar subagents in parallel.
2. Wacht op alle resultaten.
3. Run `verifier`. Als rood: triage, fix of escaleer.
4. Start parallel-groep 2. Etc.
5. Specialist-werk komt na parallel-groepen (heeft vaak dependencies).

### Fase D — Test (per fix, doorlopend)
1. Voor elke voltooide fix: roep `test-author` aan als de fix testable is.
2. Voor C1: verplicht een Playwright-test op de check-in flow.
3. Voor A5: verplicht RLS-tests.
4. Voor B-fixes: eval-harness uitbreiden.

### Fase E — Wrap (15 min)
1. Run `verifier` final-check.
2. Als alles groen: roep `pr-author` aan voor PR-body.
3. Schrijf naar `.claude/audit-output/sprint-<N>-report.md`:
   - Welke fixes voltooid (lijst van fix-IDs)
   - Welke geskipt (lijst + reden)
   - Eval-score voor/na (sprint 3 specifiek)
   - PR-body (kopie)
4. Commit alles op de sprint-branch.
5. **STOP** en wacht op user. Doe geen `git push`. Doe geen merge naar main. De user reviewt.

## Output van deze skill

Aan het einde print je:
- ✅ Voltooide fix-IDs (lijst)
- ⚠️ Geskipte fix-IDs + reden
- 📊 Sprint-stats (commits, lines changed, tests added)
- 📋 PR-body locatie (`.claude/audit-output/sprint-<N>-report.md`)
- 🎯 Volgende sprint of klaar
