---
name: fix-sprint-5
description: Sprint 5 — Polish. Laatste 11 fixes. UI/UX last mile + performance rest. Geen blockers, alleen kwaliteit.
---

# Sprint 5 — Polish

**Doel:** alles afmaken.

**Fix-IDs (3 PRs):**

### PR 1 — UI polish (E1, E5, E7, E8, E9, E10)
- E1: empty states op alle home cards
- E5: tap targets ≥ 44px
- E7: CoachOrb component bouwen
- E8: ChatSuggestions context-aware
- E9: NutritionInput volgorde swap
- E10: focus-rings op inputs

### PR 2 — Performance rest (F2, F7, F10)
- F2: Recharts dynamic import
- F7: /api/chat op Edge runtime (check Upstash rate-limiter compatibel)
- F10: dashboard cron-fallback (recompute on missing)

### PR 3 — Observability (G2, eigen PR)
- G2: structured logging (pino of vergelijkbaar)
- 111 console.log/error → log() met levels (info/warn/error)
- Console output blijft naar Vercel logs; geen externe sink (Sentry geschrapt)

### Optioneel — Lift-over (E6 als 't niet in sprint 4 paste)
Design tokens v2 incrementeel, in eigen PR(s).

## Acceptance criteria

1. Typecheck + lint groen
2. 3 PRs gemaakt
3. Bundle-size na F2: home page < 200KB JS (baseline + 0%)
4. `console.log` count < 20 (van 111)
5. Lighthouse mobile score op /: ≥ 90 performance

## Output

Sprint 5 is laatste sprint. Output:
- `.claude/audit-output/sprint-5-report.md`
- Summary: "67 fixes voltooid, X PRs gemerged in branch `audit-fixes-2026-05`, ready for review naar main."
- Final checklist met alle 67 fix-IDs ✅
