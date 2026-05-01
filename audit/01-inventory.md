# Fase 1 — Inventarisatie

Branch: `ios-polish-audit` · Datum: 2026-05-01

## 1. Routes (App Router)

### Pages (user-facing)
| Route | Bestand | Type |
|---|---|---|
| `/` (Home) | `src/app/page.tsx` → `components/dashboard/DashboardPage.tsx` + `components/home/*` | Server + client |
| `/auth/login` | `src/app/auth/login/page.tsx` | Form |
| `/auth/signup` | `src/app/auth/signup/page.tsx` | Form |
| `/belasting` | `src/app/belasting/page.tsx` | Workload/load |
| `/chat` | `src/app/chat/page.tsx` → `components/chat/ChatPage.tsx` | Streaming |
| `/check-in` | `src/app/check-in/page.tsx` | Multi-step flow |
| `/check-in/[id]/edit` | edit page | Form |
| `/check-in/history` | history page | List |
| `/goals` | `src/app/goals/page.tsx` | List + form |
| `/nutrition` | `src/app/nutrition/page.tsx` | Form + summary |
| `/progress` | `src/app/progress/page.tsx` | Charts |
| `/schema` | `src/app/schema/page.tsx` | Calendar/week |
| `/settings` | `src/app/settings/page.tsx` | Settings |
| `/workouts/[id]` | workout detail | Detail |
| `/dev/explain` | dev-only | — |

### API routes: 60+ (in `src/app/api/**`) — buiten scope iOS polish.

## 2. Shared UI components

### Layout & chrome
- `layout/Navigation.tsx` — bottom tab bar (mobile) + sidebar (lg). Glass backdrop, 86px hoog, pb-[28px] safe area handmatig.
- `layout/MiniChat.tsx` — floating chat trigger.
- `shared/TimeOfDayTheme.tsx` — circadian background overlay.
- `shared/InstallPrompt.tsx` — PWA install prompt.

### Primitives
- `ui/Button.tsx`, `ui/Card.tsx`, `ui/GlassPanel.tsx`, `ui/SectionHeader.tsx`
- `ui/v2/*` — nieuwere set: `Card`, `CoachChip`, `LoadGauge`, `MiniRing`, `PageTitle`, `ReadinessOrb`, `SportDot`, `StatCard`, `ZoneBar`
- `shared/CoachOrb`, `shared/EmptyState`, `shared/ErrorAlert`, `shared/Skeleton`, `shared/ExerciseImage`, `shared/BaselineTag`

### Feature buckets
- `home/*` (12 components) — readiness, hero, today's move, workout feed, week-at-a-glance, body comp, sync button
- `dashboard/*` — muscle heatmap (incl. drilldown sheet), adherence, sport split, training block
- `chat/*` — input, interface, message, suggestions
- `check-in/*` (14 components) — flow, plan chat, week tier, vitals, manual add modal, etc.
- `schema/*` (9 components) — week view, day sheet, plan/edit modals
- `progress/*`, `goals/*`, `nutrition/*`, `workload/*`, `trends/*`, `belasting/*`, `settings/*`, `workout/*`, `explain/*`

**Twee parallelle UI-sets in `ui/`** (`Card.tsx` en `v2/Card.tsx`) — schermen zijn deels gemigreerd. Aandachtspunt voor consistentie.

## 3. Design tokens

Bron: `src/app/globals.css` (379 lines, Tailwind v4 `@theme`-style).

### Typografie (Apple type scale, `--text-*`)
caption2 (11/13, +letter-spacing), caption1 (12/16), footnote (13/18), subhead (15/20), body/headline (17/22), title3 (20/25), title2 (22/28), title1 (28/34), large-title (34/41).
Font: SF Pro Display self-hosted + `-apple-system` fallback.

### Kleuren — twee sets naast elkaar
1. **Apple semantic system** (`--color-system-*`, `--color-label-*`, `--color-bg-primary/secondary/tertiary/grouped`, `--color-separator`) — light + dark overrides via `.dark { }`.
2. **Pulse v2** (`--color-bg-page #15171F`, `--color-bg-surface #1E2230`, `--color-bg-elevated #272C3B`, `--color-text-primary #F5F5F7` + secondary/tertiary/muted, sport accents gym/run/padel/cycle, status good/warn/bad, `--color-brand-claude #D97757`).
3. Gradients: `aurora`, `fire`, `cool`, `coach`, `ember`, plus `time-dawn/day/dusk/night` overlays.

### Radii
`--radius-card-sm 10`, `md 16`, `lg 22`, `xl 28`. (Geen Tailwind `rounded-*` mapping zichtbaar — directe CSS vars.)

### Shadows
`--shadow-apple-sm/md/lg/float`. Pulse v2 spec zegt expliciet "no drop shadow" → er is dus spanning tussen tokens en spec.

### Geen `tailwind.config.ts`
Alles via Tailwind v4 `@theme` in `globals.css`. PostCSS + `@tailwindcss/postcss` (in `postcss.config.mjs`).

## 4. Globale base/iOS keuzes (al aanwezig)

Layout (`src/app/layout.tsx`):
- `viewport-fit: cover` ✅
- `themeColor: #15171F` ✅
- `appleWebApp.capable: true` ✅
- `pt--ARB-env(safe-area-inset-top)-` op `<main>` ✅
- `pb-[86px]` voor tab bar offset (mobile) ✅
- `min-h-[100dvh]` ✅
- `maximumScale: 1` ⚠️ — blokkeert pinch-zoom (a11y issue, telt in audit)

`globals.css` base:
- `-webkit-tap-highlight-color: transparent` ✅
- `-webkit-overflow-scrolling: touch` ✅
- `overscroll-behavior-y: none` op body ✅
- `touch-action: manipulation` op body ✅
- `text-size-adjust: 100%` ✅
- `@view-transition` cross-fade + reduced-motion guard ✅

Navigation:
- Glass backdrop (`backdrop-filter: blur(24px) saturate(180%)`) ✅
- Tab bar `pb-[28px]` hardcoded — **niet** `env(safe-area-inset-bottom)` ❌ (P1 candidate)
- `min-w-[44px]` per tab ✅, maar tab item visueel ~22px icon + 10px label = mogelijk <44px effectieve hit area in hoogte (controleren)

`safe-area-inset` gebruik: alleen `layout.tsx` en `Navigation.tsx`. **Niet** in `MiniChat`, `ManualAddModal`, `PlanWeekModal`, `DayDetailSheet`, `MuscleDrilldownSheet`, `ExplainSheet`, `OnboardingWizard`, `InstallPrompt` — allemaal `position:fixed` componenten. ❌ P0/P1 candidates.

Geen `100vh` gevonden — al `100dvh` consistent. ✅

## 5. Top-10 globale issues (eerste oogopslag)

| # | Issue | Severity (verwacht) | Locatie |
|---|---|---|---|
| 1 | `maximumScale: 1` blokkeert user-zoom (WCAG 1.4.4 fail) | P0 | `layout.tsx:28` |
| 2 | Tab bar safe-area is hardcoded 28px ipv `env(safe-area-inset-bottom)` — fout op iPhone zonder home indicator (SE) en met landscape | P1 | `Navigation.tsx:64` |
| 3 | 6+ floating/fixed sheets/modals zonder safe-area handling (bottom + top) | P0/P1 | sheets/modals |
| 4 | Twee parallelle Card-systemen (`ui/Card`, `ui/v2/Card`) — risico inconsistentie | P2 | `components/ui/` |
| 5 | Twee kleuren-tokensets (Apple semantic + Pulse v2) zonder duidelijke mapping → mogelijk contrastgaten in mixed gebruik | P1 | `globals.css` |
| 6 | Inline `style={{ background: 'rgba(...)' }}` ipv tokens in nav (en mogelijk elders) | P2 | `Navigation.tsx:67-69` |
| 7 | `font-weight: 700` mapping wijst naar Bold OTF (zelfde als 600) — geen echte heavy beschikbaar | P2 | `globals.css:29` |
| 8 | Input `font-size` moet ≥16px op iOS om auto-zoom te voorkomen — niet globaal afgedwongen | P1 | te scannen in formulieren (login/signup, nutrition input, chat input) |
| 9 | `motion/react` (Framer/Motion) gebruikt — duration & easing keuzes per component, geen centrale motion preset audit | P2 | `lib/motion-presets`, per component |
| 10 | "No drop shadow" volgens Pulse v2 spec, maar `--shadow-apple-*` tokens bestaan en worden mogelijk nog gebruikt | P2 | grep nodig in fase 2 |

## 6. iPhone-kritische schermen (fase 2 audit focus)

Gerangschikt naar dagelijks gebruik volgens `CLAUDE.md` ("Huidige Prioriteit") en routeoverzicht:

1. **`/` Home** — readiness, today's move, workout feed, hero. `home/HomeHero`, `home/ReadinessSignal`, `home/TodaysMove`, `home/WorkoutFeed`, `dashboard/DashboardPage`. **Highest traffic.**
2. **`/check-in`** — wekelijkse flow met chat, multi-step, modals, sheets. Veel interactie + kritisch voor product. `check-in/CheckInFlow`, `PlanChat`, `ManualAddModal`.
3. **`/chat`** — AI coach, streaming + input. iOS keyboard interactie kritiek. `chat/ChatPage`, `ChatInput`.
4. **`/schema`** — weekplan + DayDetailSheet/PlanWeekModal/EditWeekModal — drie sheets, tap-rich.
5. **`/progress`** — charts (Recharts), TimePeriodSelector — touch targets en chart-leesbaarheid op klein scherm.
6. **`layout/Navigation`** (cross-cutting) — tab bar + More-sheet, raakt elk scherm.
7. **`layout/MiniChat`** (cross-cutting) — floating trigger.
8. **`/nutrition`** — input + lijst, snel toegevoegd op telefoon.
9. **`/workouts/[id]`** — workout detail, gelezen tijdens of na sessie.
10. **`/settings`** — minder kritisch, wel goed voor edge cases (forms, lange lijsten).

Auth pages (`/auth/login`, `/auth/signup`) zijn één-keer-flow maar wél eerste indruk → mee in P0 forms-check.

---

**STOP — Fase 1 klaar.** Wacht op je akkoord op (a) inventaris compleet, (b) prioritering schermen, voordat ik fase 2 start.
