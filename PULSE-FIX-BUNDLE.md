# Pulse Fix-Implementation Bundle

> **Doel:** 67 fixes uit `.claude/audit-output/` uitvoeren met Claude Code. (Drie fixes geschrapt op user-verzoek: G1 Sentry, G3 Supabase Pro, A4 Vault encryption — single-user accepteert die risico's.) Niet in 1 sessie (zou falen), maar in **5 sprints** met parallelle subagents en `/goal` per sprint. Tussen sprints reviewer-je en merge je.
>
> **Werkomgeving:** je hebt al `.claude/audit-output/` met 9 rapporten + 3 PR-diffs (`001-fix-checkin-week`, `002-add-ai-eval-harness`, `003-sanitize-chat-markdown-xss`). Die zijn je startpunt.

---

## 0. Waarom 5 sprints en geen mega-goal

70 fixes in 1 sessie loopt vast op drie dingen:

| Probleem | Effect |
|---|---|
| **Context overflow** | Diffs van 70 PRs passen niet in 1 sessie, ook niet met auto-compact |
| **Geen review-checkpoint** | Fix #23 breekt iets stuk → #24 t/m #70 bouwen erop voort, niemand merkt 't |
| **Dependency-volgorde** | B1 vóór B2-B12, A3 vóór F1/F2 — moeilijk te bewaken in 1 lange run |
| **PR-grootte** | 1 PR met 70 commits is onreviewbaar; 5 PRs met 10-15 commits per stuk wel |

Daarom: 5 sprints. Per sprint zet je 1 `/goal`, Claude doet 'm parallel met subagents in worktrees, jij merget, volgende sprint.

---

## 1. Sprint-overzicht

| Sprint | Doel | Fixes | Duur (auto mode) | Dependencies |
|---|---|---|---|---|
| **1. Foundation** | Veilig + meetbaar maken | 8 (P0's + tooling) | 3-5 uur | — |
| **2. Quick Wins** | Alle XS-fixes wegtikken | 24 | 4-6 uur | Sprint 1 |
| **3. AI-Laag** | Vertrouwen herstellen | 12 | 6-10 uur | B1 uit Sprint 1 |
| **4. Refactor** | Code quality + security deep | 16 | 8-12 uur | Sprint 1 (A3) |
| **5. Polish** | UI/UX last mile + perf-rest | 11 | 4-6 uur | — |
| **Totaal** | — | **67**¹ | **25-40 uur** | — |

¹ 67 unieke fixes na schrapping van G1 (Sentry), G3 (Supabase Pro), A4 (Vault). Sommige fixes worden in 2 sprints aangeraakt (D2 in sprint 1 en 4, B4 in sprint 3).

**Realistisch tijdspad voor jou:** 5-10 werkdagen met Claude Code als 't goed loopt. Sneller dan handmatig (zou 6-8 weken solo zijn).

---

## 2. Installatie (10 min)

```bash
cd ~/projects/pulse

# Folders
mkdir -p .claude/agents .claude/skills/fix-sprint-1 .claude/skills/fix-sprint-2 \
         .claude/skills/fix-sprint-3 .claude/skills/fix-sprint-4 .claude/skills/fix-sprint-5 \
         .claude/skills/verify-fix .claude/skills/make-pr

# Baseline snapshot (rollback-anker)
git checkout -b audit-fixes-2026-05
git add .
git commit -m "chore: baseline before audit fixes" --allow-empty

# Tests draaien voor baseline-vergelijking
pnpm typecheck > .claude/audit-output/baseline-typecheck.txt 2>&1 || true
pnpm lint > .claude/audit-output/baseline-lint.txt 2>&1 || true
pnpm test:e2e > .claude/audit-output/baseline-e2e.txt 2>&1 || true

echo "Baseline opgeslagen. Errors vóór de start: $(grep -c error .claude/audit-output/baseline-typecheck.txt || echo 0) typecheck, $(grep -c error .claude/audit-output/baseline-lint.txt || echo 0) lint."
```

---

## 3. CLAUDE.md aanvulling (project constitutie)

> **Pad:** `./CLAUDE.md` — **append** aan bestaande, of merge handmatig

```markdown
## Fix-mode (sprint X actief)

Wanneer een `/goal` actief is dat verwijst naar `.claude/skills/fix-sprint-N/SKILL.md`:

1. Lees ALTIJD eerst de sprint-skill en `.claude/audit-output/00-MASTER-REPORT.md`.
2. Per fix: maak een feature branch `fix/<fix-id>-<korte-naam>` van `audit-fixes-2026-05`.
3. Commit-convention: `fix(<scope>): <korte beschrijving> [<FIX-ID>]`
   - Voorbeelden: `fix(chat): sanitize markdown to prevent XSS [A1]`, `fix(check-in): plan komende week ipv huidige [C1]`
4. PRs target `audit-fixes-2026-05`, niet main. Main wordt geüpdate na sprint-review.
5. ELKE fix moet voldoen aan: typecheck pass, lint pass, en (indien testable) een nieuwe test.
6. Migration-files MOGEN NIET worden gewijzigd; alleen NIEUWE migraties aanmaken.
7. Bij twijfel of breaking change: STOP, schrijf naar `.claude/audit-output/decisions/<fix-id>.md`, vraag de gebruiker.

## Parallel work

- Gebruik `Task` tool om onafhankelijke fixes parallel te delegeren naar subagents.
- Onafhankelijk = raakt geen gedeelde files. Check met `git diff --name-only` per branch.
- Wanneer 2+ fixes hetzelfde bestand raken: serieel in 1 branch + 1 PR.

## Verboden

- `git push` naar remote zonder expliciete user-bevestiging
- Wijzigen van bestaande migraties (alleen nieuwe SQL files in supabase/migrations/)
- Wijzigen van `.claude/audit-output/` (read-only, dat is de bronwaarheid)
- Force-push, rebase op gedeelde branches, of squash zonder review
- Deps installeren die niet expliciet in een fix-spec staan
```

---

## 4. Hooks — deterministische guards

> **Pad:** `.claude/settings.json` (merge met bestaande)

```json
{
  "permissions": {
    "allow": [
      "Bash(pnpm typecheck*)",
      "Bash(pnpm lint*)",
      "Bash(pnpm test:e2e*)",
      "Bash(pnpm build*)",
      "Bash(pnpm install*)",
      "Bash(pnpm update*)",
      "Bash(pnpm audit*)",
      "Bash(pnpm add*)",
      "Bash(pnpm remove*)",
      "Bash(git checkout*)",
      "Bash(git commit*)",
      "Bash(git status*)",
      "Bash(git diff*)",
      "Bash(git log*)",
      "Bash(git branch*)",
      "Bash(git worktree*)",
      "Bash(supabase db diff*)",
      "Bash(supabase migration new*)",
      "Bash(supabase gen types*)",
      "Bash(find:*)",
      "Bash(grep:*)",
      "Bash(rg:*)",
      "Bash(wc:*)",
      "Bash(ls:*)",
      "Bash(cat:*)"
    ],
    "deny": [
      "Bash(rm -rf*)",
      "Bash(git push*)",
      "Bash(git reset --hard*)",
      "Bash(supabase db reset*)",
      "Bash(pnpm publish*)"
    ]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "command": "case \"$CLAUDE_TOOL_INPUT_FILE\" in *.ts|*.tsx) pnpm typecheck 2>&1 | tail -3 ;; esac"
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "command": "echo \"$CLAUDE_TOOL_INPUT_COMMAND\" | grep -qE 'git push|git reset --hard|rm -rf|db reset' && echo 'BLOCKED: gevaarlijk commando' >&2 && exit 2; exit 0"
      },
      {
        "matcher": "Edit|Write",
        "command": "case \"$CLAUDE_TOOL_INPUT_FILE\" in supabase/migrations/2026010*|supabase/migrations/2026020*|supabase/migrations/2026030*|supabase/migrations/2026040*) echo 'BLOCKED: wijzigen bestaande migratie verboden. Maak een nieuwe migratie via: supabase migration new <naam>' >&2; exit 2 ;; .claude/audit-output/*) echo 'BLOCKED: audit-output is read-only' >&2; exit 2 ;; esac"
      }
    ],
    "Stop": [
      {
        "command": "pnpm typecheck > /tmp/pulse-tc.log 2>&1; if [ $? -ne 0 ]; then echo 'TYPECHECK FAALT — fix of expliciet documenteren in .claude/audit-output/decisions/'; tail -10 /tmp/pulse-tc.log >&2; exit 2; fi; echo 'typecheck ok'"
      }
    ]
  }
}
```

**Wat doen deze hooks:**

1. **PostToolUse op .ts/.tsx**: na elke code-edit draait typecheck. Output verschijnt in Claude's context, dus fouten worden meteen gezien en gefixt.
2. **PreToolUse op Bash**: blokkeert `git push`, `git reset --hard`, `rm -rf`, `db reset`. Backstop tegen het deny-permission (dubbele veiligheid).
3. **PreToolUse op Edit/Write**: blokkeert wijzigen van bestaande migraties en audit-output (read-only zones).
4. **Stop-hook**: typecheck moet groen zijn voor Claude mag stoppen. Anders blijft 'ie werken aan de fout.

---

## 5. Subagents — specialisten per domein

### 5.1 Algemene fix-implementer

> **Pad:** `.claude/agents/fix-implementer.md`

```markdown
---
name: fix-implementer
description: Voert een enkele fix uit de Pulse audit uit. Generiek voor XS/S complexity fixes (verwijder code, voeg config toe, kleine refactor). Krijgt fix-ID + audit-output context. Output: branch, commit, samenvatting.
tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
---

Je bent een senior fullstack engineer. Je krijgt EÉN fix-ID (bv. "A8", "E4", "F1") en moet die exact uitvoeren.

## Werkstroom

1. **Lees de bron**: `.claude/audit-output/0X-*.md` zoek naar het fix-ID. Lees ook de relevante sectie in `00-MASTER-REPORT.md` voor context.
2. **Maak een branch**: `git checkout -b fix/<FIX-ID-lowercase>-<korte-slug> audit-fixes-2026-05`
3. **Implementeer de fix** zoals beschreven in de audit. Wijk niet af zonder reden.
4. **Verifieer**:
   - `pnpm typecheck` — moet groen
   - `pnpm lint` — moet groen of niet-verslechterd t.o.v. baseline
   - Als de fix testable is: schrijf een test in `tests/` die de oude bug reproduceert en nu pass't.
5. **Commit**: `git commit -m "fix(<scope>): <samenvatting> [<FIX-ID>]"` met conventional commit format.
6. **Output**: een samenvatting (max 100 woorden) met:
   - Wat is veranderd (file:lines)
   - Welke test is toegevoegd
   - Eventuele edge cases die je niet hebt afgedekt
   - Of er follow-up nodig is

## Wanneer je MOET stoppen en escaleren

- De fix raakt > 5 files of > 200 regels. (Te groot voor een fix-implementer; vraag om escalatie naar een specialist agent.)
- De fix vereist een DB migratie. (Vraag escalatie naar `db-migrator`.)
- De fix raakt AI-prompts of context-assembly. (Vraag escalatie naar `ai-refactorer`.)
- Tijdens implementatie ontdek je een gerelateerde bug die niet in het audit-rapport staat.
- Je weet niet zeker of de aanpak correct is.

Bij escalatie: schrijf naar `.claude/audit-output/decisions/<FIX-ID>.md` wat je hebt gevonden, en stop. Geef die summary terug aan de hoofdthread.

## Anti-patterns

- Niet "even mee opruimen" code die niet bij deze fix hoort. Eén fix, één commit, één PR.
- Niet eigen TypeScript types verzinnen als er al een type bestaat — gebruik wat er is.
- Niet `as any` of `as unknown as` toevoegen om typecheck te omzeilen — los het echt op.
```

### 5.2 AI-refactorer (voor sprint 3)

> **Pad:** `.claude/agents/ai-refactorer.md`

```markdown
---
name: ai-refactorer
description: Specialist voor refactors in de AI-laag van Pulse (src/lib/ai/, src/app/api/chat/, src/app/api/check-in/). Diepe kennis van Anthropic Claude API, Vercel AI SDK v6, tool definitions met Zod, prompt caching, context assembly. Gebruik voor B-laag fixes uit de audit.
tools: Read, Write, Edit, Bash, Glob, Grep, WebSearch
model: opus
---

Je bent een AI engineer die jaren met de Anthropic API werkt. Pulse's AI-laag is jouw expertise-domein.

## Context

Lees ALTIJD eerst voor je begint:
- `.claude/audit-output/02-ai-system.md` (volledige analyse)
- `.claude/audit-output/decisions/` (eerdere beslissingen)
- `src/lib/ai/CHANGELOG.md` (als die bestaat)

## Principes voor B-fixes

1. **Eval-harness is heilig**. Voor je iets in `src/lib/ai/` of een prompt wijzigt: draai `pnpm eval:ai` (uit PR 002). Score verbetert of blijft gelijk. Anders revert en denk opnieuw.
2. **Geen XML-write-paden**. Schrijf-acties (B3) gaan ALTIJD via AI SDK tools met Zod. Geen regex-parsing van AI output meer.
3. **Prompt caching**. Statische delen van system prompts (rolbeschrijving, blessure-protocols, do/don't) horen in een gecachte block. User-specific data in een aparte block.
4. **Tools > inline context**. Body composition, schema, blessure-historie: tools, geen hardcoded data in prompts (zie B11).
5. **Conversation history compressie** (B8): Haiku samenvat oudste turns als > 15 turns.

## Werkstroom per fix

1. Lees fix-spec in audit-output.
2. Branch: `fix/<FIX-ID>-<slug>` van `audit-fixes-2026-05`.
3. Implementeer.
4. Voeg eval-cases toe als de fix een nieuw failure-scenario raakt (in `scripts/eval-ai/cases.ts`).
5. Draai `pnpm eval:ai` voor + na. Save output naar `.claude/audit-output/eval-results/<FIX-ID>.txt`.
6. Typecheck + lint groen.
7. Commit: `fix(ai): <samenvatting> [<FIX-ID>]`
8. Schrijf naar `src/lib/ai/CHANGELOG.md`: wat is veranderd en waarom.

## Wanneer je twee fixes mag combineren

Combineer fixes in 1 PR alleen als ze:
- Hetzelfde bestand raken (anders aparte PRs)
- Of dezelfde refactor-richting hebben (bv. B3 + A11 + D4 = "stop met XML, gebruik tools")
- Of een ondeelbare logische eenheid vormen

Voorbeelden van toegestane combos:
- B3 + A11 + D4 → één PR "AI write-back via tools" 
- B7 + B11 → één PR "ai context via tools, niet hardcoded"
- B5 + B9 → één PR "AI context defensive limits"

Niet combineren: B2 (classifier) staat los. B6 (weekly prompt dedup) staat los.

## Output naar hoofdthread

- Welke fixes zijn voltooid
- Eval-score voor/na (key metrics)
- Welke prompts zijn gewijzigd (file paths)
- Wat is in CHANGELOG geschreven
```

### 5.3 Security engineer

> **Pad:** `.claude/agents/security-engineer.md`

```markdown
---
name: security-engineer
description: Specialist voor security-kritische fixes in Pulse. Auth refactors, RLS, secrets management, OWASP. Gebruik voor A5, A11 en alle andere fixes die security-impact hebben.
tools: Read, Write, Edit, Bash, Glob, Grep
model: opus
---

Je bent een application security engineer. Je doet defense-in-depth, geen quick patches die later weer lek raken.

## Principes

1. **Defense in depth**: één laag is niet genoeg. RLS + service-role-restraint + Zod-validation, alle drie.
2. **Secrets nooit in code**: env vars of secret manager.
3. **Encryption at rest** voor PII (Hevy API key, Google refresh token, HAE token).
4. **Least privilege**: API routes hebben de minimale permissions nodig.

## Specifieke fixes

### A5 — server.ts splitsen (groot)
- Maak `src/lib/supabase/admin.ts` voor service-role calls
- Maak `src/lib/supabase/ssr.ts` voor user-scoped SSR calls met cookie auth
- Update alle imports:
  - Cron jobs, ingest webhooks, admin routes → admin.ts
  - Alle andere route handlers → ssr.ts
- Schrijf tests die verifiëren dat user-routes RLS respecteren (probeer een rij van een andere user_id te lezen, moet falen).
- Dit raakt ~40 bestanden. Doe het in ÉÉN PR maar split commits per directory.

### A11 — write-back validatie (combineer met B3, D4)
- Coördineer met `ai-refactorer` als die parallel werkt aan B3.
- Vervang `extractWritebacks` door echte AI SDK tools met `inputSchema: z.object({...})`.
- Tool calls naar DB krijgen extra Zod-validatie at DB-write time (defense in depth).

## Output

- Welke fix is voltooid
- RLS-tests die slagen (concrete output)
- Eventuele backwards-compat lagen die later opgeruimd moeten
```

### 5.4 DB-migrator

> **Pad:** `.claude/agents/db-migrator.md`

```markdown
---
name: db-migrator
description: Specialist voor Supabase migraties. Voor F3 (indexen), A6 (RLS verify), G4 (auth trigger). Schrijft idempotente, reversible SQL.
tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
---

Je bent een database engineer. Postgres en Supabase RLS zijn je dagelijkse werk.

## Hard rules

1. **NOOIT** een bestaande migratie wijzigen. Alleen NIEUWE migraties.
2. **Migration filename**: `supabase/migrations/YYYYMMDDHHMMSS_<descriptive_name>.sql`. Gebruik `supabase migration new <naam>` voor de naming.
3. **Elke migratie moet idempotent zijn**: `CREATE INDEX IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, etc.
4. **Elke migratie heeft een down-script** in een comment-blok onderaan voor handmatige rollback.
5. **Verifieer LOKAAL** voor je commit: `supabase db reset --local` op een schone DB + `supabase db push --local`.

## Standaard workflow

1. `supabase migration new <descriptive_name>`
2. Open de gegenereerde file. Schrijf SQL.
3. `supabase db push --local` (lokaal testen)
4. `supabase gen types typescript --local > src/types/database.ts` (types regenereren)
5. Run typecheck. Als TypeScript klaagt: er is iets met de DB-types veranderd, fix de aanroepende code.
6. Commit migratie + database.ts samen.

## Specifieke fixes

### F3 — Indexen
Eén migratie met alle indexen:
```sql
CREATE INDEX IF NOT EXISTS idx_workout_exercises_exercise_def 
  ON workout_exercises(exercise_definition_id);
CREATE INDEX IF NOT EXISTS idx_personal_records_workout 
  ON personal_records(workout_id);
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_workouts_title_trgm 
  ON workouts USING gin(title gin_trgm_ops);
-- + alle andere uit fase 5
```

### A6 — RLS verify (geen migratie, alleen verificatie)
Run dit als read-only query, output naar `.claude/audit-output/rls-verify.txt`:
```sql
SELECT tablename, policyname, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname='public' 
ORDER BY tablename, policyname;
```
Als ergens `USING (true)` staat: STOP en escaleer naar security-engineer voor patch-migratie.

### G4 — Auth trigger
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_settings (user_id, ...defaults...)
  VALUES (new.id, ...);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## Output

- Migratie-filename
- SQL-samenvatting
- Of types zijn geregenereerd
- Of typecheck nog groen is
```

### 5.5 Test-author

> **Pad:** `.claude/agents/test-author.md`

```markdown
---
name: test-author
description: Schrijft Playwright E2E tests + unit tests voor fixes. Gebruik na ELKE non-trivial fix om regressies te voorkomen. Speciaal voor C1 (week-calc), B1 (eval-harness uitbreiden), A5 (RLS-tests).
tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
---

Je bent een test engineer. Je schrijft tests die de bug FIRST reproduceren (red), dan pas bevestigen dat de fix werkt (green).

## Standaard structuur

- Unit tests: `tests/unit/<feature>.test.ts` (vitest)
- E2E tests: `tests/e2e/<flow>.spec.ts` (Playwright)
- AI eval cases: `scripts/eval-ai/cases.ts`
- RLS tests: `tests/rls/<table>.test.ts` (specifiek voor A5)

## Werkstroom

1. Lees de fix-spec.
2. Identificeer het bug-scenario (wat was fout?).
3. Schrijf een test die het ECHT triggert. Test moet rood zijn op de baseline branch.
4. Voer de fix uit (of laat de fix-implementer dat doen).
5. Test moet groen worden.
6. Commit tests samen met de fix (niet apart).

## Specifieke tests die ik wil

### C1 — Check-in week-calculation
```typescript
// tests/unit/check-in-week.test.ts
import { describe, test, expect } from 'vitest';
import { getNextWeekRange, getCurrentWeekRange } from '@/lib/dates/week';

describe('check-in week calculation', () => {
  test('zondag 23:30 Amsterdam = afgelopen week ma-zo', () => { /* ... */ });
  test('maandag 00:30 Amsterdam = aanstaande maandag start nieuwe week', () => { /* ... */ });
  test('DST transition 29 maart 2026', () => { /* ... */ });
  test('DST transition 25 oktober 2026', () => { /* ... */ });
  test('week-erna eindigt op zondag 23:59:59', () => { /* ... */ });
});
```

### A5 — RLS tests
```typescript
// tests/rls/workouts.test.ts
import { test, expect } from '@playwright/test';

test('user A kan niet de workouts van user B lezen', async ({ request }) => {
  const userA = await loginAs('a@test');
  const userB = await loginAs('b@test');
  // Maak workout als B, probeer te lezen als A. Moet 403/empty zijn.
});
```

### B1 — Eval cases uitbreiden
Voeg minimaal 5 cases toe per nieuwe AI-fix in deze sprint.

## Output

- Test files toegevoegd
- Welke runners (vitest, playwright, eval:ai)
- Of alle tests groen zijn na de fix
```

### 5.6 PR-author

> **Pad:** `.claude/agents/pr-author.md`

```markdown
---
name: pr-author
description: Schrijft PR-descriptions voor merged fixes. Verzamelt alle commits van een sprint en bouwt een review-ready PR-body. Gebruik aan einde van elke sprint.
tools: Read, Bash, Glob, Grep
model: haiku
---

Je bent een tech writer voor engineering PRs. Strak, scannable, zonder hyperbool.

## Workflow

1. Bepaal welke commits in deze PR zitten:
   ```bash
   git log audit-fixes-2026-05..HEAD --oneline
   ```
2. Voor elke fix-ID in commit messages, lees `.claude/audit-output/0X-*.md` voor context.
3. Schrijf PR-body in dit format:

```markdown
# Sprint <N> — <korte titel>

Sluit fix-IDs: <komma-gescheiden lijst, bv. A1, A2, A8, C1, ...>

## Wat doet deze PR

<2-4 zinnen, geen marketingtaal. Wat is concreet veranderd en waarom.>

## Per fix

### A1 — XSS sanitize in chat markdown
**Wat:** `src/components/chat/ChatMessage.tsx` gebruikt nu `rehype-sanitize`.
**Waarom:** prompt-injection via Hevy/HAE data kon `<script>` injecten.
**Test:** `tests/e2e/chat-xss.spec.ts` — feeds payload met `<script>alert(1)</script>`, verifieert dat 't escaped wordt.

### A2 — ...
...

## Verifieerbaar

- [x] `pnpm typecheck` groen
- [x] `pnpm lint` groen of niet-verslechterd
- [x] `pnpm test:e2e` groen (X tests, +Y nieuw)
- [x] `pnpm eval:ai` score: <baseline> → <na PR>
- [x] Geen wijzigingen in bestaande migraties

## Niet in deze PR

<Wat is bewust niet gedaan en in welke sprint dat wel komt. Voorbeelden: D3 (te groot, eigen PR in sprint 4); E6 (design tokens v2, eventueel later).>

## Rollback-plan

Revert deze PR: `git revert <merge-commit-sha>`. Geen migraties met irreversible state.
```

## Output

PR-body als markdown, klaar voor copy-paste in GitHub/Vercel.
```

### 5.7 Verifier (rauwe checker, niet AI-judgment)

> **Pad:** `.claude/agents/verifier.md`

```markdown
---
name: verifier
description: Runt typecheck, lint, tests, eval-harness en rapporteert exact wat groen/rood is. Geen oordeel, gewoon feiten. Gebruik aan einde van elke sprint vóór PR-author.
tools: Bash, Read
model: haiku
---

Je bent een CI-checker. Run commands, rapporteer exit-codes en relevante log-snippets. Geen interpretatie.

## Standaardcheck

```bash
echo "=== TYPECHECK ===" && pnpm typecheck 2>&1 | tail -20
echo "=== LINT ===" && pnpm lint 2>&1 | tail -20
echo "=== UNIT TESTS ===" && pnpm test 2>&1 | tail -30
echo "=== E2E ===" && pnpm test:e2e 2>&1 | tail -30
echo "=== AI EVAL ===" && pnpm eval:ai 2>&1 | tail -10
echo "=== GIT STATUS ===" && git status --short
echo "=== BRANCHES VS BASELINE ===" && git log audit-fixes-2026-05..HEAD --oneline
echo "=== DEPENDENCIES AUDIT ===" && pnpm audit --severity high 2>&1 | tail -10
```

Rapporteer in dit format:

```
SPRINT VERIFY REPORT
====================
Typecheck: PASS / FAIL (X errors)
Lint:      PASS / FAIL (X errors)
Tests:     X passed, Y failed, Z skipped
E2E:       X passed, Y failed
AI Eval:   score X/30 (baseline: Y/30)
Branches:  X commits ahead of baseline
Deps:      X high vulns
```

Geen suggesties, geen "ik denk dat..." — alleen meetbare output.
```

---

## 6. Master skill — orchestrator

> **Pad:** `.claude/skills/fix-pulse-sprint/SKILL.md`

```markdown
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
   - **Parallel-veilig**: fixes die geen overlappende files hebben. Delegeer naar `fix-implementer` subagent in parallel via Task tool.
   - **Specialist-werk**: fixes die naar specifieke subagent moeten (security-engineer, ai-refactorer, db-migrator).
   - **Combos**: fixes die in 1 PR moeten (bv. B3 + A11 + D4).
3. Output: tabel met (fix-ID, agent, parallel-groep). Toon aan gebruiker voor goedkeuring vóór Fase C.

### Fase C — Execute (bulk werk)
1. Start parallel-groep 1: Task-calls naar subagents in parallel.
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
```

---

## 7. Per-sprint skills

### Sprint 1 — Foundation

> **Pad:** `.claude/skills/fix-sprint-1/SKILL.md`

```markdown
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
5. `scripts/eval-ai/cases.ts` bestaat met ≥ 30 testcases
6. `pnpm eval:ai` runt zonder errors en geeft een score
7. `tests/unit/check-in-week.test.ts` bestaat en is groen (≥ 5 testcases incl. DST)
8. `.claude/audit-output/sprint-1-report.md` bestaat met PR-body

## Stop-condities

STOP en escaleer naar user als:
- A3 (Next.js update) breekt > 5 files na update. Mogelijk major-version migration nodig.
- C1 fix faalt op DST-cases (29 maart of 25 oktober 2026). Vraag user om de test te bekijken.

## Output

- Sprint-1 PR-body in `.claude/audit-output/sprint-1-report.md`
- Lijst van fix-IDs voltooid
- Eval-harness baseline-score
```

### Sprint 2 — Quick Wins (24 XS-fixes)

> **Pad:** `.claude/skills/fix-sprint-2/SKILL.md`

```markdown
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

Groepen A t/m E zijn parallel-veilig (geen overlappende files behalve binnen één groep). Delegeer 5 parallelle Tasks naar `fix-implementer` subagents.

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
```

### Sprint 3 — AI-Laag

> **Pad:** `.claude/skills/fix-sprint-3/SKILL.md`

```markdown
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
+ Voeg eval-cases voor lange gesprekken (turn 20+).

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
```

### Sprint 4 — Refactor

> **Pad:** `.claude/skills/fix-sprint-4/SKILL.md`

```markdown
---
name: fix-sprint-4
description: Sprint 4 — Code quality + security deep. De grote refactors. 16 fixes inclusief A5 (server.ts splitsen), D3 (as unknown as), E6 (design tokens). Vereist: sprints 1-3 voltooid.
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
```

### Sprint 5 — Polish

> **Pad:** `.claude/skills/fix-sprint-5/SKILL.md`

```markdown
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
- Summary: "70 fixes voltooid, X PRs gemerged in branch `audit-fixes-2026-05`, ready for review naar main."
- Final checklist met alle 70 fix-IDs ✅
```

---

## 8. Worktree workflow (parallelle PRs)

Voor sprint 2 (24 parallelle fixes) is git worktrees écht nuttig. In plaats van 6 branches sequentieel op één werkdir:

```bash
# Setup eens (alleen sprint 2)
git worktree add ../pulse-fix-A audit-fixes-2026-05
git worktree add ../pulse-fix-B audit-fixes-2026-05
git worktree add ../pulse-fix-C audit-fixes-2026-05
git worktree add ../pulse-fix-D audit-fixes-2026-05
git worktree add ../pulse-fix-E audit-fixes-2026-05
git worktree add ../pulse-fix-F audit-fixes-2026-05

# In je Claude Code session, in elke worktree een aparte Task:
# Task 1 → ../pulse-fix-A → groep A (auth)
# Task 2 → ../pulse-fix-B → groep B (AI XS)
# Task 3 → ../pulse-fix-C → groep C (code quality)
# Task 4 → ../pulse-fix-D → groep D (UI XS)
# Task 5 → ../pulse-fix-E → groep E (perf XS)
# Task 6 → ../pulse-fix-F → groep F (DB migration)

# Echt parallel: 6 subagents werken tegelijk in 6 worktrees, eigen filesystem.
# Aan einde: terug naar hoofdwerkdir, merge alle 6 branches in audit-fixes-2026-05.

# Cleanup
git worktree remove ../pulse-fix-A
# etc.
```

**Niet voor sprints met dependencies** (sprint 3, 4). Daar werk je serieel met parallelle subagents in dezelfde worktree.

---

## 9. Daily driver — hoe je 't draait

### Eerste sessie (sprint 1)

```bash
cd ~/projects/pulse
claude

# Plan mode aan (Shift+Tab tot 'PLAN' indicator)
/goal Sprint 1 voltooien volgens .claude/skills/fix-sprint-1/SKILL.md. Klaar wanneer (a) git log toont ≥8 commits met fix-IDs A1,A2,A3,A8,A9,C1,D2,B1, (b) pnpm typecheck groen, (c) pnpm audit --severity high geeft 0, (d) scripts/eval-ai/cases.ts bestaat met ≥30 cases, (e) tests/unit/check-in-week.test.ts bestaat en pnpm test daar groen op is, (f) .claude/audit-output/sprint-1-report.md bestaat met PR-body. Of stop na 50 turns.
```

Claude toont plan. Review. Plan mode uit. Auto mode aan. Claude voert uit. Tussendoor pauzeren: `/goal` zonder argument toont status.

### Tussen sprints

1. **Review de PR-body** in `.claude/audit-output/sprint-<N>-report.md`
2. **Lees de commits**: `git log audit-fixes-2026-05..HEAD --oneline`
3. **Run zelf**: `pnpm test:e2e`, `pnpm eval:ai`, klik door de app
4. **Twijfel?** Open `.claude/audit-output/decisions/` voor de redenering achter twijfelpunten
5. **Merge naar main** (na review): nieuwe branch `audit-fixes-applied`, merge daar, dan PR naar main
6. **Reset baseline voor volgende sprint**: `git checkout audit-fixes-2026-05 && git merge audit-fixes-applied`
7. **Start volgende sprint**: nieuwe Claude Code sessie, `/goal Sprint 2 ...`

### Sprint 3 specifieke driver (AI-laag)

```bash
# Eerst eval-baseline opslaan
pnpm eval:ai > .claude/audit-output/eval-baseline.txt 2>&1

claude
/goal Sprint 3 voltooien volgens .claude/skills/fix-sprint-3/SKILL.md. Vereist: pnpm eval:ai geeft een score. Klaar wanneer (a) 4 PRs gemaakt met fix-IDs B2, B3+A11+D4, B7, B4+B5+B6+B8+B11+B12, (b) pnpm typecheck groen, (c) pnpm eval:ai score ≥ baseline+5, (d) geen XML-write parsing meer in src/app/api/chat/route.ts (grep extractWritebacks geeft 0), (e) src/lib/ai/CHANGELOG.md heeft 4 nieuwe entries. Of stop na 80 turns en rapporteer wat ontbreekt.
```

---

## 10. Stop-condities (sprint-overstijgend)

Stop ALTIJD en escaleer als:

1. **Eval-score zakt** > 5 punten in sprint 3.
2. **Production-impact**: een migratie of refactor lijkt onomkeerbaar (PII-data herschikken zonder backup).
3. **> 100 files changed** in 1 PR. Te groot voor review.
4. **Tests die op baseline groen waren**, worden rood en niet door deze fix.
5. **AI doet onverwachte dingen** (hallucineert een fix-ID die niet in de audit staat, of pakt een file uit `.claude/audit-output/` aan).
6. **Claude geeft op** ("ik weet 't niet" of "kan dit niet"): valid response. Documenteer in `.claude/audit-output/decisions/<FIX-ID>.md` met de open vraag.

---

## 11. Realistische tijdslijn

| Week | Activiteit |
|------|-----------|
| **Dag 1 (4 uur)** | Setup + sprint 1 starten. Eind van dag: PR voor review klaar. |
| **Dag 2 (1 uur)** | Sprint 1 reviewen + mergen naar audit-fixes-applied. |
| **Dag 2-3 (6 uur)** | Sprint 2 (24 quick wins, parallel met worktrees). |
| **Dag 4 (1 uur)** | Sprint 2 reviewen + mergen. |
| **Dag 4-6 (10 uur)** | Sprint 3 (AI-laag, het zwaarste). |
| **Dag 7 (2 uur)** | Sprint 3 reviewen, evals dubbelchecken. |
| **Dag 7-9 (12 uur)** | Sprint 4 (refactor). |
| **Dag 10 (2 uur)** | Sprint 4 reviewen. |
| **Dag 10-11 (6 uur)** | Sprint 5 (polish). |
| **Dag 11 (1 uur)** | Sprint 5 reviewen. |
| **Dag 12** | Finale merge naar main. 70 fixes done. |

Met onderbrekingen voor je dagelijks werk: 2-3 weken in totaal. Geconcentreerd: 5-6 dagen.

---

## 12. Wat als iets faalt?

### Sprint blijft hangen op één fix

- Check status: `/goal` (zonder argument)
- Als al > 60 turns: er is iets vastgelopen. Lees de laatste 10 turns terug.
- `/goal clear` om te stoppen
- Open `.claude/audit-output/decisions/` of `git status` om te zien waar 'ie zit
- Restart sessie met meer specifieke prompt: "Continue sprint X waar je gebleven was. De fix-IDs nog te doen zijn: [...]"

### Een fix breekt iets

- `git log --oneline -5` → zoek de commit
- `git revert <sha>` op de sprint-branch
- Document in `.claude/audit-output/decisions/<FIX-ID>.md` waarom de fix niet werkte
- Voeg toe aan een "later" bucket. Doe sprint af zonder die fix.

### Claude wil deps installeren die niet in een fix staan

- Standaard hook blokkeert dit niet. Maar `verifier` rapporteert nieuwe deps.
- In review: check `git diff package.json`. Vraag waarom als 't onverwachte deps zijn.

### Eval-score zakt onverwacht in sprint 3

- Revert de laatste commit
- Lees `scripts/eval-ai/cases.ts` — welke cases falen nu?
- Mogelijk is een case te streng geformuleerd. Vraag user.

---

## 13. Antwoord op je vraag concreet

**"Maak een claude code prompt om dit goed uit te voeren"**

Dat is sprint 1 (eerste prompt). Met de bundle hierboven, na installatie:

```
/goal Sprint 1 voltooien volgens .claude/skills/fix-sprint-1/SKILL.md. Klaar wanneer (a) git log toont ≥8 commits met fix-IDs A1,A2,A3,A8,A9,C1,D2,B1, (b) pnpm typecheck groen, (c) pnpm audit --severity high geeft 0, (d) scripts/eval-ai/cases.ts bestaat met ≥30 cases, (e) tests/unit/check-in-week.test.ts bestaat en pnpm test daar groen op is, (f) .claude/audit-output/sprint-1-report.md bestaat met PR-body. Of stop na 50 turns.
```

Daarna sprint 2 t/m 5 op vergelijkbare manier.

**"Met de juiste skills, agents, etc."**

- 1 master skill: `fix-pulse-sprint`
- 5 sprint-skills: `fix-sprint-1` t/m `fix-sprint-5`
- 7 subagents: `fix-implementer`, `ai-refactorer`, `security-engineer`, `db-migrator`, `test-author`, `pr-author`, `verifier`
- 4 hooks: PostToolUse typecheck, PreToolUse safety (push/reset/migrations), Stop typecheck

**"Wees uitgebreid"**

Zie hierboven. Voor elke sprint: doel, fix-IDs, parallel-groepering, acceptance criteria, stop-condities.

**"Parallel"**

- Binnen sprint 2: 5 parallelle Tasks (groepen A-E) via worktrees
- Binnen sprint 3: serieel (AI-fixes hebben afhankelijkheden)
- Binnen sprint 4: 2 parallelle (D-fixes), serieel voor security deep (A5)

**Verwijzing naar audit completion (jouw bericht):**

> "Audit klaar. Alle exit-criteria gehaald: (a) 9 rapporten aanwezig: ✅ 00-MASTER-REPORT.md + 01 t/m 08 in .claude/audit-output/ (b) Elk rapport ≥800 woorden: ✅ minimum is 08-checkin-bug-rca.md met 1.601 woorden; maximum is 02-ai-system.md met 5.356; totaal 27.668 woorden (c) ≥3 PR-diffs in prs/: ✅ 001-fix-checkin-week-calculation.diff, 002-add-ai-eval-harness.diff, 003-sanitize-chat-markdown-xss.diff"

Die 3 PR-diffs zijn de starter voor sprint 1:
- `001-fix-checkin-week-calculation.diff` → C1 (sprint 1)
- `002-add-ai-eval-harness.diff` → B1 (sprint 1)
- `003-sanitize-chat-markdown-xss.diff` → A1 (sprint 1)

Met andere woorden: sprint 1 start met 3 van de 9 fixes al uitgewerkt als diff. `fix-implementer` past die diffs toe (`git apply` of handmatig integreren) in plaats van from scratch.
