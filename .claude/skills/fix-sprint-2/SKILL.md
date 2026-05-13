---
name: fix-sprint-2
description: Sprint 2 — Quick Wins. 24 XS-effort fixes parallel uitvoeren. Geen complexe refactors, alleen kleine targeted patches. Maximale doorvoer met parallelle subagents.
---

# Sprint 2 — Quick Wins

**Doel:** alle XS-fixes wegtikken. Geen complexe refactors. Pure doorvoer.

**Fix-IDs (in 5 parallel-groepen op file-overlap):**

### Groep A — Auth/Security XS (1 PR)
- A6 (RLS verify, geen code-change, alleen rapport)
- A7 (Hevy webhook timing-safe-equal)
- A10 (OAUTH_STATE_SECRET losse env)
- G6 (rate-limit cap op AI check-in)

### Groep B — AI XS (1 PR, raakt context-assembler + chat route)
- B5 (loadCoachingMemory limit)
- B9 (result.usage try/catch)
- B10 (memory-extractor telemetrie — `console.error` met context + extractor naam, geen Sentry)
- B12 (response-length policy in chat-system prompt)

### Groep C — Code-quality XS (1 PR, opruim)
- D12 (verplaats bodyMapData.ts)
- D13 (hevyFetch generic weg)
- D15 (ProgressPage inline)
- G5 (HEVY_API_KEY env-fallback weg)
- G7 (googleapis keep/remove beslissen)

### Groep D — UI/UX XS (1 PR, kleine UI cleanup)
- E2 (ReadinessSignal skeleton)
- E4 (pb-24 dubbele padding)
- E11 (Navigation dark: class fix)
- E12 (motion-presets initial variant)
- E13 (dode code CheckInFlow)

### Groep E — Performance XS (1 PR + 1 migratie-PR)
- F1 (server-only guard op googleapis)
- F4 (Promise.all in workouts/[id])
- F5 (useSchema refreshInterval 0)
- F6 (revalidateOnFocus: false op 3 hooks)
- F8 (select specifieke columns ipv *)
- F9 (ExerciseImage optimization)

### Groep F — DB-migratie (SEPARATE PR, db-migrator agent)
- F3 (indexen toevoegen)
- G4 (on_auth_user_created trigger)

## Parallelle uitvoering

Groepen A t/m E zijn parallel-veilig (geen overlappende files behalve binnen één groep). Delegeer 5 parallelle Agents naar `fix-implementer` subagents.

Groep F serieel via `db-migrator` (DB-werk).

## Acceptance criteria

1. Typecheck + lint groen
2. ≥ 24 commits met fix-IDs
3. 6 PRs op de stack (A-F)
4. F3 migratie file bestaat in `supabase/migrations/`
5. `src/types/database.ts` is geregenereerd na F3+G4

## Anti-scope

- Geen "even meenemen" van P1/P2 fixes uit andere sprints.
- Geen "even refactoren omdat 't toch al openstaat".
- Eén groep = één thema = één PR. Geen Frankenstein.
