# Token Strategy — Pulse v2 vs Apple Semantic

Branch: `ios-polish-audit` · Datum: 2026-05-01 · **Strategie-deliverable, geen polish-fix.**

## TL;DR

De codebase heeft **twee** kleur-tokensets in `globals.css`:
1. **Apple semantic** (`--color-system-*`, `--color-label-*`, `--color-bg-primary/secondary/tertiary/grouped`, `--color-separator`) met `light` defaults én `.dark { }` overrides.
2. **Pulse v2** (`--color-bg-page/surface/elevated`, `--color-text-primary/secondary/tertiary/muted`, sport accents, status, brand) — dark-only, hardcoded.

In de praktijk **wint Pulse v2 al**: 115 components gebruiken Pulse v2 tokens, slechts 3 files refereren expliciet naar Apple semantic, en die enige 3 references gebruiken `bg-bg-grouped` — dat in dark mode tóch naar `--color-bg-page` remapt. **Apple semantic is de facto dode code.**

Aanbeveling: **convergeer richting Pulse v2** in een dedicated refactor PR (niet in deze polish-fase). Deprecateer Apple semantic-tokens en verwijder light-mode CSS branch.

---

## 1. Functionele mapping

Welke Pulse v2 token vervangt welke Apple semantic token (in dark-only context):

| Apple semantic | Pulse v2 equivalent | Conflict in waarde? |
|---|---|---|
| `--color-bg-primary` (dark: remap to `bg.page`) | `--color-bg-page` `#15171F` | Geen — al gemapt |
| `--color-bg-secondary` (dark: remap to `bg.surface`) | `--color-bg-surface` `#1E2230` | Geen |
| `--color-bg-tertiary` (dark: remap to `bg.elevated`) | `--color-bg-elevated` `#272C3B` | Geen |
| `--color-bg-grouped` (dark: remap to `bg.page`) | `--color-bg-page` | Geen |
| `--color-surface-primary` `#1C1C1E` (dark) | `--color-bg-surface` `#1E2230` | **Ja** — verschillende hex (#1C1C1E vs #1E2230). Pulse v2 is iets warmer/blauwer. |
| `--color-surface-secondary` `rgba(28,28,30,0.8)` | `--color-bg-glass-strong` `rgba(255,255,255,0.08)` | **Ja** — andere logica (donker-doorzicht vs licht-overlay). |
| `--color-label-primary` `#FFFFFF` (dark) | `--color-text-primary` `#F5F5F7` | Klein — Apple is puur wit, Pulse iets gedempt (Apple Fitness+ patroon). |
| `--color-label-secondary` `rgba(235,235,245,0.6)` | `--color-text-secondary` `rgba(245,245,247,0.66)` | Vergelijkbaar; Pulse iets lichter en meer opaque. |
| `--color-label-tertiary` `rgba(235,235,245,0.3)` | `--color-text-tertiary` `rgba(245,245,247,0.46)` | Pulse iets lichter. |
| `--color-system-blue` `#0A84FF` | (geen direct equivalent in Pulse v2 set; `sport.cycle` of accent kleuren zijn sport-specifiek) | Verschillende doelen — Apple system-blue is generieke "primary action", Pulse v2 heeft die rol niet expliciet. |
| `--color-system-red` `#FF453A` | `--color-status-bad` `#FF4D6D` | **Ja** — andere hue (red vs pink-red). |
| `--color-system-green` `#30D158` | `--color-status-good` `#22D67A` | **Ja** — Apple meer grasgroen, Pulse meer mint. |
| `--color-system-orange` `#FF9F0A` | `--color-status-warn` / `--color-sport-padel` `#FFB020` | **Ja** — Pulse is geler. |
| `--color-separator` `rgba(84,84,88,0.6)` (dark) | `--color-bg-border` / `--color-bg-border-strong` | Klein — beide donkere lijnen op dark, andere alpha. |
| Apple light-mode hele set (`#FFFFFF`, `#F2F2F7`, etc.) | **n.v.t.** | Light mode is uitgeschakeld via `<html className="dark">` — branch is unreachable. |

### Conflict-zwaartepunten
- **Status-kleuren**: Apple system red/green/orange ≠ Pulse status bad/good/warn. Code dat `text-system-red` gebruikt voor "fout" kleurt anders dan code met `text-status-bad`. Vandaag triviaal (geen file gebruikt `text-system-red`), maar token set in CSS suggereert beschikbaarheid.
- **Surface-kleur**: Apple `surface-primary` `#1C1C1E` ligt op een ander warmte-pad dan Pulse `bg.surface` `#1E2230`. Bij naast elkaar gebruik valt het verschil op.
- **Generieke "primary action" kleur ontbreekt in Pulse v2**: Apple `system-blue` is daar de defacto choice; Pulse v2 vertrouwt op sport-specifieke accenten of `brand-claude`. Voor neutrale CTA's (login button, save button) **moet de convergence-PR een `--color-action-primary` introduceren** of expliciet documenteren dat we sport-accenten daarvoor inzetten.

## 2. Codebase-gebruik (telling)

Gerund met grep over `src/`:

| Patroon | Files |
|---|---|
| Pulse v2 tokens (`bg-bg-page/surface/elevated`, `text-text-*`, `sport-*`, `status-*`, `brand-claude`, `gradient-*`) | **115** |
| Apple semantic tokens (`text-label-*`, `bg-bg-primary/secondary/grouped`, `text-system-*`, `border-separator`) | **3** (waarvan alle 3 alleen `bg-bg-grouped`) |
| Beide sets in zelfde file | 2 (de auth pages + layout — door `bg-bg-grouped`) |
| Hardcoded hex (`#[0-9A-Fa-f]{6}`) in components | **228 occurrences** |

Top-10 files met hex-hardcodes (kandidaten voor token-extractie tijdens convergence):
- `src/components/ui/Button.tsx`
- `src/components/ui/v2/{LoadGauge,PageTitle,StatCard,ZoneBar,ReadinessOrb,SportDot,MiniRing}.tsx`
- `src/components/settings/shared.tsx`
- `src/components/settings/SettingsPage.tsx`

228 hex-occurrences is een orthogonaal probleem: ongeacht convergence-richting moeten die naar tokens. De HIG-audit (`03-hig-findings.md`) heeft hier 40+ violations als P1/P2 al gemarkeerd.

## 3. Contrastmatrix (samenvatting; volledig in `04-measurable-findings.md`)

### Pulse v2 dark — text op alle 3 backgrounds
- `text.primary` ✅ AAA op alle bg's (12.78–16.42)
- `text.secondary` ✅ AA op alle bg's (5.92–7.62)
- `text.tertiary` ❌ **AA-text fail** (3.39–4.35) — alleen large text
- `text.muted` ❌ Total fail (1.73–2.23) — niet voor text gebruiken

### Apple semantic dark — label op `surface-primary` (#1C1C1E)
- `label-primary` ✅ AAA (17.01)
- `label-secondary` ✅ AA (5.94)
- `label-tertiary` ❌ AA-fail (2.48)

### Apple semantic light — onbereikbaar zolang `<html.dark>`
- `label-secondary` op wit: 3.44 ❌ — fail van begin af aan in Apple's eigen spec
- `label-tertiary` op wit: 1.74 ❌

### Cross-set hazard (als per ongeluk light bg actief wordt)
- Pulse `text.primary` `#F5F5F7` op `#FFFFFF` = 1.09 → onleesbaar.

**Conclusie**: contrast-kwaliteit is op de tertiary-niveaus in beide sets even slecht; convergence lost dat **niet** vanzelf op. Het verbreden van text-tertiary naar AA-conform `~#9A9BA0` (ratio ~5.5 op `#15171F`) moet onderdeel van de convergence-PR zijn.

## 4. Aanbeveling

### Optie A — Convergeren naar Pulse v2 (aanbevolen)

**Argumenten:**
- 115 vs 3 files: refactor is klein.
- Apple light-mode branch is dode code (forced `dark` class); compileert wel mee in CSS.
- Pulse v2 heeft sport/brand/gradient tokens die Apple semantic niet biedt — toekomstbestendig.
- One-source-of-truth: simplere mental model voor nieuwe components.

**Acties (separate PR, na polish-fase):**
1. Verwijder light-mode CSS in `globals.css` (alle `:root`-default kleuren behalve dark-mode mapping).
2. Verwijder `.dark { }` block — tokens zijn al direct gedefinieerd.
3. Hernoem of verwijder `--color-system-*` (of map naar Pulse equivalent met expliciete documentatie).
4. Verwijder `--color-label-*`, `--color-surface-*`, `--color-bg-primary/secondary/tertiary/grouped`, `--color-separator`. Update de 3 files die `bg-bg-grouped` gebruiken naar `bg-bg-page`.
5. Introduceer `--color-action-primary` (suggestie: gebruik `--color-sport-gym-base` `#00E5C7` of een specifiek systeemblauw als generieke primary CTA, expliciete keuze).
6. Pas `text.tertiary` opnieuw aan (`#9A9BA0` of vergelijkbaar) zodat AA-text haalt op `bg.page`. Document `text.muted` als "niet voor body text".
7. Codemod 228 hex-occurrences → tokens (1 file per commit, dat is veilig).

**Risico:** laag. Refactor met behoud van dark-mode visual.

### Optie B — Bewust gescheiden houden

Geen reden gevonden. De Apple semantic-set was vermoedelijk de oorspronkelijke setup; Pulse v2 is daar overheen geplakt zonder cleanup. Er is geen scenario waarin de twee sets allebei actief nodig zijn.

## 5. Risico-analyse: welke fase 3 polish-fixes worden weggegooid bij latere convergence?

Markering convention: **🔴 wegwerp** (fix wordt overschreven), **🟡 stand-alone** (overleeft convergence), **🟢 versterkt convergence** (helpt de migratie).

| Fix-categorie (uit fase 3) | Impact bij latere convergence |
|---|---|
| **P0 a11y/touch targets** (h-9 → h-11, aria-label toevoegen, focus rings) | 🟡 stand-alone — geen kleur-coupling |
| **iOS Safari safe areas** (env() insets in modals/sheets) | 🟡 stand-alone |
| **Viewport / `maximumScale` / `dvh`** | 🟡 stand-alone |
| **Input font-size ≥16px globaal** (vermoedelijk via shared `INPUT_CLASSES`) | 🟡 stand-alone |
| **Typografie token-discipline** (vervang `text-[Npx]` door `text-body/headline/title*`) | 🟢 versterkt convergence |
| **Radius token-discipline** (vervang `rounded-[Npx]` door `rounded-card-md/lg`) | 🟢 versterkt convergence |
| **Kleur token-discipline — vervang `#0A84FF`-achtige hex door token** | **🔴 risico**: als je in fase 3 hardcoded `#0A84FF` (Apple system-blue) door `text-system-blue` token vervangt, wordt die token in convergence-PR weer geremoved. **Gebruik tijdelijk Pulse v2 alternative of laat de hex even staan en parkeer voor convergence-PR.** |
| **Padel kleur fix** (`status-warn` → `sport-padel-base` voor padel-context) | 🟡 stand-alone — beide tokens overleven |
| **Dark-mode pariteit** (light-leftovers in components verwijderen) | 🟢 versterkt convergence |
| **Material/depth/motion fixes** (backdrop-blur, reduced-motion, glass on modals) | 🟡 stand-alone |
| **Consolideren ui/Card vs ui/v2/Card naar één** | 🟡 stand-alone — orthogonaal aan tokens |

### Concrete instructie voor fase 3
Tijdens fase 3, als je een hex-hardcode tegenkomt die naar **Apple semantic** zou wijzen (`#0A84FF`, `#FF453A`, `#1C1C1E`, etc.):
- Ofwel laat staan met `// TODO: token convergence — kies Pulse v2 equivalent of action-primary`
- Ofwel vervang direct door **Pulse v2** equivalent uit de mapping-tabel hierboven

**Niet** vervangen door `--color-system-*` of `--color-label-*` — dat is tegen-de-stroom werk.

## 6. Beslissing nodig (jij)

- [ ] Akkoord met Optie A (convergeer naar Pulse v2)?
- [ ] Convergence-PR plannen voor **na** de iOS polish (fase 3+4) of als parallel spoor?
- [ ] Akkoord met instructie aan fase 3: hex-hardcodes naar Apple semantic-tokens worden **niet** geïntroduceerd; Pulse v2 of TODO-comment.
- [ ] Akkoord met text.tertiary recalibration als onderdeel van convergence-PR (niet polish-fase)?
