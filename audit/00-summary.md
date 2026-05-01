# Fase 2 — Samenvatting & prioriteit

Branch: `ios-polish-audit` · Datum: 2026-05-01

## Tellingen per rapport

| Rapport | P0 | P1 | P2 | Totaal |
|---|---|---|---|---|
| `02-vercel-findings.md` (Vercel WIG) | 33 | 41 | 26 | 100 |
| `03-hig-findings.md` (Apple HIG) | 55 | 31 | 29 | 115 |
| `04-measurable-findings.md` (contrast) | 2 | 2 | 1 | 5 |
| `05-ios-safari-findings.md` (iOS/keyboard/PWA) | 11 | 17 | 16 | 44 |
| **Totaal (incl. dubbeltellingen)** | **101** | **91** | **72** | **264** |

Dubbelingen tussen rapporten zijn reëel (bv. iOS-zoom op inputs zit in 02 én 05; touch targets in 02 én 03). De fix-volgorde hieronder is op categorie, niet op rapport — dat ontdubbelt vanzelf.

## Top-10 grootste-impact issues

1. **Inputs <16px → iOS auto-zoom op focus** (17+ inputs/textareas). Eén edit aan een gedeelde `INPUT_CLASSES` plus 6 individuele fixes lost dit op. _Refs: 02 P0, 05 sectie 2._
2. **Bottom-sheets/modals zonder `env(safe-area-inset-bottom)`** — knoppen achter home-indicator op iPhone. 7 sheets + 2 sticky footers. _Refs: 03, 05 P0._
3. **`maximumScale: 1` blokkeert pinch-zoom** (WCAG 1.4.4 fail). 1-line fix. _Refs: 05 P1._
4. **Reduced-motion compliance vrijwel afwezig** — 118 animaties, alleen `CoachOrb` + view-transition respecteren `prefers-reduced-motion`. Raakt motion/react variants, `animate-spin`, `animate-pulse` skeletons, Recharts, TimeOfDayTheme fade, SVG ring transitions. _Refs: 02, 03 P0._
5. **~50 icon-only buttons onder 44px** — `h-6` t/m `h-9` dominant. Chat send button, modal closes, schema time pickers, settings rows. _Refs: 02, 03 P0._
6. **Modal a11y gaps** — `ManualAddModal`, `EditWeekModal`, `PlanWeekModal`, `DayDetailSheet`, `OnboardingWizard` missen `role="dialog"`, `aria-modal`, Escape-handler. _Refs: 02, 03 P0._
7. **Auth forms missen autoComplete/inputMode/autoCapitalize** — geen Keychain-integratie, slechte mobile keyboard. _Refs: 02, 05 P1._
8. **Tab bar gebruikt hardcoded `pb-[28px]` ipv `env(safe-area-inset-bottom)`** — fout op iPhone SE en in landscape. _Refs: 05 P1._
9. **PWA standalone breekt visueel** — manifest `theme/background_color` zijn light (`#F2F2F7`); witte splash-flash op donkere app. `appleWebApp.statusBarStyle: 'default'` ipv `'black-translucent'`. _Refs: 05 P0._
10. **Apple type tokens worden grotendeels omzeild** — 80% van schermen gebruikt `text-[Npx]` ipv `text-body/headline/title*`. 228 hex hardcodes voor kleur. _Refs: 03 P1, 06 token-strategy._

## Voorgestelde fix-volgorde (fase 3)

Volgorde gebaseerd op (a) impact op echte iPhone-gebruik, (b) afhankelijkheden tussen fixes, (c) risico op breken.

### Groep 1 — P0 a11y & touch targets _(blokkers)_
**Effort: M.** Files: ~15.
- `INPUT_CLASSES` centraal naar 16px font-size (raakt Settings/CheckIn/Goals).
- 6 file-lokale input-fixes die geen shared class delen (auth pages, OnboardingWizard, NutritionInput, ChatInput, PlanChat, EditReviewForm, ManualAddModal, WeekPlanCard, etc.).
- Verwijder `maximumScale: 1` uit `layout.tsx` viewport.
- Verhoog 50 icon-only buttons naar `h-11` (44px) of voeg invisible-padding hit-area toe.
- Voeg `role="dialog"`, `aria-modal="true"`, Escape-handler toe aan 5 modals.
- Voeg `autoComplete`, `inputMode`, `autoCapitalize` toe aan auth + nutrition forms.

**Verificatie**: re-run `/web-interface-guidelines` op gewijzigde files; `validate-touch-targets` (handmatig in HIG-stijl).

### Groep 2 — iOS Safari safe areas & viewport _(visuele blokkers iPhone)_
**Effort: S.** Files: ~10.
- Tab bar `pb-[28px]` → `pb-[max(env(safe-area-inset-bottom),12px)]` + `pl/pr--ARB-env(...)-`.
- `<main>` `pb-[86px]` → `pb-[calc(86px+env(safe-area-inset-bottom))]` + `pl/pr--ARB-env(...)-` voor landscape.
- 7 bottom-sheets + 2 sticky footers: `pb--ARB-env(safe-area-inset-bottom)-` toevoegen.
- 7 modals: `vh` → `dvh`.
- `MiniChat`, `InstallPrompt`: safe-area op `bottom`/`right`.
- `ChatPage` `h-[calc(100dvh-86px)]` herrekenen na tab-bar fix.

**Verificatie**: live test in iOS Safari + iOS Simulator (PWA). Visueel.

### Groep 3 — Reduced-motion compliance _(a11y)_
**Effort: S–M.** Files: ~20.
- `motion/react`: voeg `useReducedMotion()` hook toe waar variants worden gebruikt; switch naar identity-variants.
- Recharts: `<XYZChart isAnimationActive={!reducedMotion}>` op alle charts (TonnageTrend, VolumeChart, ProgressionChart, RunningChart, StrengthChart, GoalSparkline, en TrendsPage charts).
- `animate-spin` / `animate-pulse` skeletons: media-query gate in `globals.css` of conditional class.
- `TimeOfDayTheme` 1500ms fade: skip indien reduced-motion.
- SVG ring transitions in `ReadinessSignal`, `LoadGauge`, `MiniRing`: gate via media query.
- CoachOrb `animate-coach-orb` heeft al gate ✅ — niet aanraken.

**Verificatie**: macOS Reduce Motion toggle; visuele check + automated grep voor `animate-` zonder media-gate.

### Groep 4 — Forms & input UX _(quality of life op iPhone)_
**Effort: S.** Files: ~8.
- Globale focus-ring utility (vervang `outline-none` zonder substitute door `focus:ring-2 focus:ring-sport-gym-base/40` of equivalent).
- 50 missende `htmlFor` ↔ `id` koppelingen (controleer NutritionInput, ManualAddModal, OnboardingWizard, GoalForm, EditWeekModal).
- `enterkeyhint` op chat send + form submit inputs.

### Groep 5 — PWA standalone fixes
**Effort: XS.** Files: 3.
- `public/manifest.json`: `theme_color` & `background_color` → `#15171F`. Voeg 192×192 + maskable icons toe.
- `layout.tsx` `appleWebApp.statusBarStyle`: `'default'` → `'black-translucent'`.
- `InstallPrompt.tsx`: detecteer iOS standalone via `navigator.standalone === false` + UA-check; toon iOS-specifieke "Tap share → add to home screen" instructie ipv `beforeinstallprompt`.

### Groep 6 — Typografie & radius token-discipline
**Effort: M.** Files: ~30+.
- Vervang `text-[Npx]` door `text-large-title/title1/title2/title3/headline/body/subhead/footnote/caption1/caption2`.
- Vervang `rounded-[Npx]` door `rounded-card-sm/md/lg/xl`.
- **Niet** kleur-hex aanpakken hier (zie `06-token-strategy.md`); parkeer voor convergence-PR.
- Lift `text.tertiary` waar het body text betreft naar `text.secondary`, of accepteer als large-text-only en check dat regel-context dit toelaat.

### Groep 7 — Material/depth/motion polish _(Apple feel)_
**Effort: M.** Files: ~10.
- Modal `backdrop-blur-sm` → `backdrop-blur-xl saturate-180`.
- `prefers-reduced-transparency` media query toevoegen — fallback op solid surface.
- Drop shadows die Pulse v2 spec verbiedt: scan & verwijder waar Pulse v2 cards bedoeld zijn.
- Motion presets (`lib/motion-presets.ts`) doorkijken en standaardiseren op Apple easing curves (`cubic-bezier(0.4, 0, 0.2, 1)` en `cubic-bezier(0.32, 0.72, 0, 1)`).

### Groep 8 — Component-specifieke HIG bijschaaf _(rest)_
**Effort: M.** Resterende P1/P2 uit `03-hig-findings.md`: typografische hiërarchie per scherm, padel-kleur fix (`status-warn` → `sport-padel-base`), CoachOrb tap-area op Home, "›"-glyph naar lucide-icon, hero VoiceOver `aria-label`, etc.

## Effort schatting totaal

| Groep | Effort | Files | Risico |
|---|---|---|---|
| 1. P0 a11y & touch | M | ~15 | Laag — primitive changes |
| 2. iOS safe areas | S | ~10 | Laag — additieve CSS |
| 3. Reduced-motion | S–M | ~20 | Laag |
| 4. Forms UX | S | ~8 | Laag |
| 5. PWA fixes | XS | 3 | Laag |
| 6. Tokens (typo+radius) | M | ~30 | Medium — visuele regressie risico |
| 7. Material/motion polish | M | ~10 | Medium |
| 8. Resterend HIG | M | divers | Laag |

Totaal: ~3–5 sessies werk, gerangschikt zodat eerste 5 groepen (de echte iOS-blockers) in 1 dag afgerond kunnen.

## Wat NIET wordt gefixed in fase 3

Parkeer-lijst (na akkoord apart traject):
- **Token convergence** (Apple semantic ↔ Pulse v2 unification) — zie `06-token-strategy.md`. Polish-fase introduceert geen nieuwe Apple semantic refs; concrete migratie blijft eigen PR.
- **228 hex-hardcodes naar tokens** — hangt aan token convergence-keuze.
- **`text.tertiary` recalibration** — onderdeel van convergence-PR.
- **`ui/Card` vs `ui/v2/Card` consolidatie** — orthogonale refactor, niet polish.
- **75% van bestanden is `'use client'`** — RSC-conversie is een andere kerf.
- **iOS Simulator workflow tests** (Neon Watty skill) — pas na fase 3 fixes; geen toegevoegde waarde nu.

## Beslissing nodig (jij, voor fase 3)

- [ ] Akkoord op fix-volgorde (groep 1 → 8)?
- [ ] Welke groepen wil je nu fixen, en welke parkeren?
- [ ] Akkoord met "geen kleur-hex aanpassingen" tijdens polish (parkeren voor token-convergence-PR)?
- [ ] Akkoord op `00-summary.md` als ground-truth voor fase 3 commit-volgorde?

Lees ook `06-token-strategy.md` apart — dat is de architectuurvraag die parallel beantwoord moet worden.

---

**STOP — Fase 2 klaar.** Wacht op je akkoord + groepselectie voordat ik fase 3 start.
