> **Visual references in this plan resolve to the v2 design system.**
> Source of truth: `design/design_handoff_pulse_v2/` (tokens: `tokens.js`,
> screens: `screens/*.jsx`, spec: `README.md`).
>
> Any reference to `PULSE-DESIGN-SYSTEM.md` is **stale** — that file is deprecated.
> Use the v2 dark tokens directly.

---

# PLAN-IMPLEMENTATION.md

Hoe we `BACKLOG.md` praktisch afwerken — met welke agents, skills, plugins en in welke volgorde. Dit is geen vervanging voor de stories zelf; het is de *workflow* eromheen.

Opgesteld: 2026-04-29.

---

## Uitgangspunten

1. **Stef blijft human-in-the-loop.** Eén story = één review-moment. Geen batches.
2. **Klein → groot.** Eerst Sprint 0 in z'n geheel verifiëren in productie voordat Sprint 1 begint. Sprint 1+ stories binnen één sprint mogen wel parallel.
3. **Test-bewijs vóór "klaar".** Een story is pas done als de acceptatiecriteria observable zijn (browser-test, type-check, evt. Playwright).
4. **Geen scope-creep.** Story-grenzen worden vastgehouden. Refactoring buiten scope = nieuw ticket.
5. **Vercel als single source of truth voor productie.** Geen lokale "het werkt op mijn machine" claims voor UI-stories — altijd preview-deploy als eindcheck.

---

## Skill/agent-map (referentie)

| Wanneer | Skill / Agent | Doel |
|---|---|---|
| Voor élke story start | `superpowers:brainstorming` | Intent + design-keuzes scherp krijgen vóór code |
| Voor elke implementatie | `superpowers:writing-plans` | Concreet stappen-plan met file-paths en test-criteria |
| Bij UI-werk (Tier 1, 2) | `frontend-design:frontend-design` | Visuele kwaliteit > generieke AI-aesthetiek |
| Bij DB/migration werk (Tier 3) | `feature-dev:code-architect` | Schema-keuzes en RLS-patterns |
| Bij bug-fixes (Tier 0) | `superpowers:systematic-debugging` | Root cause vóór fix |
| Bij elke implementatie | `superpowers:test-driven-development` | Failing test eerst waar haalbaar |
| Bij meerdere gelijktijdige stories | `superpowers:dispatching-parallel-agents` | Echte parallelisatie waar dependencies dat toelaten |
| Bij grote stories | `superpowers:using-git-worktrees` | Isolatie zodat parallelle PR's niet botsen |
| Vóór "ik ben klaar" zeggen | `superpowers:verification-before-completion` | Bewijs eerst, claim daarna |
| Voor PR-merge | `superpowers:requesting-code-review` of `code-review:code-review` | Review op stories met >1 file |
| Bij Vercel-vragen tijdens implementatie | `vercel:env`, `vercel:vercel-cli`, `vercel:deployments-cicd`, `vercel:nextjs`, `vercel:next-cache-components`, `vercel:ai-sdk` | Plug-in expert kennis i.p.v. trial-and-error |
| Bij Claude API-werk | `claude-api` | Prompt caching, tokens, model-keuzes |
| Bij Anthropic SDK-debugging | `vercel:ai-sdk` (al bekend) | Stream errors, tool-use patterns |
| Voor commit + PR | `commit-commands:commit-push-pr` | Conventional commit + PR-body |
| Voor Pulse-design-systeem keuzes | Direct lezen: `design/design_handoff_pulse_v2/tokens.js` + relevant `screens/*.jsx` | v2 dark system; `PULSE-DESIGN-SYSTEM.md` is deprecated en niet meer raadplegen |
| Voor security review (UXR-100, UXR-120 — RLS) | `security-review` slash command | RLS audit |

---

## Standaard workflow per story

```
┌────────────────────────────────────────────────────────────────────┐
│ Stap 1 — Brainstorm (skill)                                        │
│   superpowers:brainstorming                                        │
│   Output: scope, acceptatiecriteria scherp, ontwerpkeuzes vast.    │
├────────────────────────────────────────────────────────────────────┤
│ Stap 2 — Verkennen (agent of direct)                               │
│   Korte stories: Glob/Grep/Read direct.                            │
│   Grote stories: Agent(subagent_type=feature-dev:code-explorer).   │
│   Output: bestaande patterns gevonden, file-paths geïdentificeerd. │
├────────────────────────────────────────────────────────────────────┤
│ Stap 3 — Plan (skill)                                              │
│   superpowers:writing-plans                                        │
│   Output: stappen-plan met te creëren/wijzigen files + tests.      │
├────────────────────────────────────────────────────────────────────┤
│ Stap 4 — Failing test (skill, optioneel)                           │
│   superpowers:test-driven-development                              │
│   Voor pure logic-stories (UXR-101, UXR-110, UXR-130):             │
│   eerst falende unit-test, dan implementatie.                      │
│   UI-stories: vaak Playwright e2e i.p.v. unit (later, optioneel).  │
├────────────────────────────────────────────────────────────────────┤
│ Stap 5 — Implementeer (direct)                                     │
│   Edit / Write / Bash tools.                                       │
│   Bij UI-werk: paralel `frontend-design` skill voor visual taal.   │
├────────────────────────────────────────────────────────────────────┤
│ Stap 6 — Verifieer (skill + tools)                                 │
│   superpowers:verification-before-completion                       │
│   - `pnpm tsc --noEmit` (typecheck)                                │
│   - `pnpm lint`                                                    │
│   - Browser-test van AC's (lokale dev OF preview deploy)           │
│   - Playwright run als die bestaat                                 │
├────────────────────────────────────────────────────────────────────┤
│ Stap 7 — Review (agent of skill)                                   │
│   - Klein (1 file, <50 regels): geen formele review nodig          │
│   - Middel/groot: Agent(subagent_type=feature-dev:code-reviewer)   │
│     of `superpowers:requesting-code-review`                        │
│   - Tier 3 met RLS: ook `security-review` slash command            │
├────────────────────────────────────────────────────────────────────┤
│ Stap 8 — Commit + PR (skill)                                       │
│   commit-commands:commit-push-pr                                   │
│   Branch: `feature/UXR-XXX-korte-beschrijving`                     │
│   Wacht op preview-deploy.                                         │
├────────────────────────────────────────────────────────────────────┤
│ Stap 9 — Productie-check (Vercel plugin)                           │
│   - Vercel preview URL loopt door                                  │
│   - vercel:env: env vars correct in Preview environment            │
│   - vercel:status: deployment succesvol                            │
│   - Stef test in browser, geeft GO of NO-GO                        │
├────────────────────────────────────────────────────────────────────┤
│ Stap 10 — Merge + close                                            │
│   Story status → done in BACKLOG.md (markdown checkbox)            │
└────────────────────────────────────────────────────────────────────┘
```

---

## Sprint-orchestratie

### Sprint 0 — sequentieel

UXR-001 en UXR-002 staan los van elkaar maar zijn beide klein. Stef test dezelfde browser-sessie. **Niet parallel** — ze raken hetzelfde "dev server draait" venster.

```
UXR-001 (login) → verifieer → UXR-002 (chat jitter) → verifieer → deploy
```

**Skills:** `systematic-debugging` (al gedaan in chat hierboven), `verification-before-completion`, `commit-push-pr`. Eén PR voor allebei (gerelateerde quick wins).

### Sprint 1 — parallel mogelijk

UXR-010, UXR-020, UXR-030 zitten in verschillende files en raken verschillende data-paden:

```
┌─ UXR-010 (readiness endpoint) → UXR-011 (UI)
├─ UXR-020 (ACWR corridor)
└─ UXR-030 (CoachOrb)
```

**Aanpak:** dispatch 3 parallelle agents in één bericht (Stap 5 van workflow), elk met eigen brainstorming/plan vooraf. Skill: `superpowers:dispatching-parallel-agents`.

**Worktrees:** *aan*, want 3 parallelle PR's. Skill: `superpowers:using-git-worktrees`.

**Volgorde van merge:** UXR-030 eerst (CoachOrb is een dependency-magnet voor latere stories), dan UXR-011 (gebruikt orb), dan UXR-020.

### Sprint 2 — gemengd

UXR-040 en UXR-060 raken beide de homescreen layout — **sequentieel**, anders merge-conflicten.

UXR-050 (theming) staat los — **parallel** met UXR-040.

```
┌─ UXR-050 (theming, kan altijd)
└─ UXR-040 (hero) → UXR-060 (triad)
```

### Sprint 3 — strikt sequentieel

UXR-100 → UXR-101 → UXR-102 zijn een keten. Schema → service → UI helper.

**Extra zorg bij UXR-100:**
- `feature-dev:code-architect` agent voor RLS + index ontwerp
- `security-review` slash command vóór merge
- Test op preview met productie-data-sample (lokaal)

### Sprint 4 — parallel

UXR-070, UXR-080, UXR-090 staan los van elkaar. **3 parallelle agents** met worktrees.

### Sprint 5 — sequentieel binnen feature, parallel tussen

```
┌─ UXR-110 (sport correlations, standalone)
└─ UXR-120 (journal schema) → UXR-121 (UI) → UXR-122 (extractor)
```

UXR-110 kan parallel naast de UXR-120-keten lopen.

### Sprint 6 — parallel

UXR-140, UXR-150, UXR-160, UXR-130 zijn allemaal losstaand qua files. **4 parallelle agents.**

---

## Concrete eerste vier acties (vandaag)

Wat ik nú zou doen, in deze volgorde, na jouw GO:

1. **`/schedule` over 1 week** → reviewer agent die de Sprint 0+1 voortgang checkt en open punten teruggeeft. (Optioneel, maar past in de "human-in-the-loop maar niet voortdurend nudgen" werkwijze.)

2. **UXR-001 implementeren** — 5 minuten:
   - Skill: `superpowers:systematic-debugging` (al gedaan, root cause bekend)
   - Edit `login/page.tsx` + `signup/page.tsx`
   - Verifieer in dev: log uit, log in, kom direct op `/`
   - Skill: `verification-before-completion`

3. **UXR-002 implementeren** — 1 uur:
   - Skill: `superpowers:writing-plans` (kort plan: split scroll-effect, module-level components, isNearBottom helper)
   - Implementatie
   - Test in browser: stuur lange chat-vraag, scroll handmatig naar boven tijdens streaming, verifieer dat view daar blijft

4. **PR voor Sprint 0** — `commit-commands:commit-push-pr`
   - Branch: `feature/UXR-001-002-sprint0-bugfixes`
   - Wacht op Vercel preview
   - Skill: `vercel:status` + `vercel:env` om env-keys te verifiëren in preview
   - Stef test op preview-URL → merge naar main

---

## Hoe we Vercel inzetten

Nu de Vercel plugin geauthenticeerd is:

| Activiteit | Skill / tool |
|---|---|
| Preview-deploy status checken | `vercel:status` |
| `ANTHROPIC_API_KEY` mismatch debuggen | `vercel:env-vars` + Vercel MCP env tools |
| Function logs lezen na bug-report | Vercel MCP get-deployment-logs (via plugin tools) |
| AI SDK + Anthropic optimization | `vercel:ai-sdk` |
| Cache-strategie voor Today's Move (UXR-080) | `vercel:next-cache-components` (`use cache` + `cacheLife`) |
| Cron voor baseline aggregate (UXR-101) | `vercel:vercel-functions` + `vercel:deployments-cicd` |

**Defensieve verbeteringen die we direct aan Sprint 0 kunnen koppelen** (kost 30 min):
- `export const maxDuration = 60` op `/api/chat/route.ts`
- AI auth-error → distinct error code → client toont specifieke melding (geen "[ERROR] Fout bij genereren")
- Health-check endpoint `/api/health/ai` (preventie tegen herhaling van het invalid-key incident)

Dit zijn geen losse stories maar een hardening-PR die naast Sprint 0 mag draaien.

---

## Quality gates

Een story is **NIET** done totdat:

- [ ] Alle AC's observable getest in browser
- [ ] `pnpm tsc --noEmit` schoon
- [ ] `pnpm lint` schoon
- [ ] Bij UI: Playwright-test bestaat of bewust overgeslagen (story-notitie waarom)
- [ ] Bij DB: RLS-policy gechecked, security-review uitgevoerd
- [ ] Preview-deploy succesvol
- [ ] Stef heeft GO gegeven op preview-URL
- [ ] PR gemerged op main, story-checkbox aangevinkt in `BACKLOG.md`

---

## Risico-mitigatie

| Risico | Mitigatie |
|---|---|
| Worktree-merge-conflicten bij parallelle UI-stories | Worktrees + tightly scoped files in elke story; UXR-040 en UXR-060 *expliciet sequentieel* gemarkeerd |
| Baseline-engine (UXR-101) faalt op productie-volume | Backfill-script eerst lokaal tegen productie-snapshot; dan op preview met read-only key |
| AI tool errors breken de hele streaming-loop | Hardening-PR uit Sprint 0 voegt `onError` toe aan `streamText` (reeds geadviseerd in chat) |
| Sport-correlations (UXR-110) levert generieke insights | TDD-style: schrijf 4 verschillende synthetische week-scenarios, verwacht 4 verschillende insights vóór merge |
| Triad ringen (UXR-060) voelen "Apple-kopie" en niet eigen | `frontend-design` skill expliciet inroepen voor signature-momenten — vraag om NIET-Apple-kopie variant |

---

## Communicatie tijdens implementatie

- Na elke story: kort statement (max 3 zinnen) wat klaar is + preview-URL
- Bij architectuur-keuze die niet in dit plan staat: stop en vraag (CLAUDE.md regel)
- Bij scope-creep aanvraag tijdens story: "wil je een nieuw ticket of toevoegen aan deze story?" → niet zelf beslissen
- Geen tussentijdse "ik ben bezig met X" updates tenzij er een blocker is

---

## Wat heb ik nu nodig om te starten?

Drie bevestigingen:

1. **Plan + backlog goedgekeurd** (of welke wijzigingen)
2. **Sprint 0 GO** — ik mag UXR-001 en UXR-002 implementeren
3. **Hardening-PR** — wil je dat ik die naast Sprint 0 meeneem (maxDuration, distinct error codes, /api/health/ai), of pas later?

Daarna ga ik in deze volgorde aan de slag:
- UXR-001 (5 min) → verifieer
- UXR-002 (~1u) → verifieer
- Hardening-PR (30 min) → verifieer
- PR(s) → preview deploy → jouw test → merge
- Korte status update → wachten op GO voor Sprint 1
