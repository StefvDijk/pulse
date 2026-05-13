---
name: fix-sprint-4
description: Sprint 4 — Code quality + security deep. De grote refactors. 16 fixes inclusief A5 (server.ts splitsen), D3 (as unknown as), E6 (design tokens). Vereist sprints 1-3 voltooid.
---

# Sprint 4 — Refactor

**Doel:** technical debt aanpakken. De refactors die je 6 maanden voor je uit hebt geschoven.

**Vereiste vóór start:**
- Sprint 1, 2, 3 voltooid en gemerged in `audit-fixes-2026-05`

**Fix-IDs (5 PRs):**

### PR 1 — Code helpers centraliseren (D1, D9, D10)
- D1: alle `formatDate`/`formatTime`/`formatWeek` → `src/lib/formatters.ts`
- D9: types uit `route.ts` → `src/types/api.ts` + `src/types/check-in.ts`
- D10: sport-types → `src/lib/constants.ts`
Subagent: `fix-implementer`

### PR 2 — React anti-patterns (D5, D6, D8, D14, D16)
- D5: useEffect props→state op 3 plekken
- D6: key={index} fixen op 3 lijsten
- D8: CoachAnalysisCard → SWR
- D14: "use client" opruimen (incrementeel, start met 10 grootste)
- D16: Settings save error UX
Subagent: `fix-implementer`

### PR 3 — Schema dedup (D7, eigen PR)
- D7: SchemaPageContent dubbele fetch
- Mogelijk endpoint mergen
Subagent: `fix-implementer`

### PR 4 — Zod-cast cleanup (D3, eigen PR, groot)
- Alle 16 `as unknown as` → Zod schemas
- Per query een schema in `src/lib/schemas/db/`
- Runtime validation bij Supabase-returns
Subagent: `fix-implementer` met `test-author`

### PR 5 — Security deep (A5, eigen PR)

**A5 — server.ts splitsen** (eigen PR, security-engineer)
- `src/lib/supabase/admin.ts` (service-role)
- `src/lib/supabase/ssr.ts` (user-scoped SSR)
- Update ~40 imports
- RLS-tests toevoegen

> **Geschrapt:** A4 (Vault encryption) viel weg met G3 (Supabase Pro). Hevy API key, HAE token en Google refresh token blijven plaintext in DB. Single-user accepteert dit risico.

### PR 6 — E6 design tokens v2 (eigen PR, kan ook later)
**Mogelijk te groot voor deze sprint.** Inschatting eerst: hoeveel files raakt het echt? Als > 50 → eigen sprint of incrementeel met feature-flag.

## Acceptance criteria

1. Typecheck + lint groen
2. Alle 5 PRs gemaakt (PR1-PR5, optioneel PR6 voor E6)
3. RLS-tests slagen (probeer cross-user read → 403/empty)
4. `as unknown as` count daalt van 16 → 0
5. PR-template ingevuld per PR

## Stop-condities

- A5 raakt > 60 files → split per directory (api routes eerst, dan components)
- D3 vindt typing-issues die niet via Zod op te lossen zijn → escaleer, mogelijk database.ts regenereren
- E6 raakt > 50 files → uitstellen, eigen sprint
