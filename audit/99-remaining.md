# Fase 4 — Wat NIET is gefixt en waarom

Branch: `ios-polish-audit` · Status: bewuste parkeerlijst.

## 1. Token-convergence (uit `06-token-strategy.md`)

**Niet gedaan in deze branch.** Aparte PR ná akkoord op convergence-richting.
- Apple semantic kleur-tokens deprecateren (`--color-system-*`, `--color-label-*`, `--color-bg-primary/secondary/tertiary/grouped`, `--color-separator`).
- Light-mode CSS branch verwijderen.
- 228 hex-hardcodes naar tokens (incl. de 40+ `#0A84FF` references die binnen polish niet zijn aangeraakt).
- `text.tertiary` recalibreren naar AA-conform (`#9A9BA0` of equivalent op `#15171F`).
- Generieke `--color-action-primary` introduceren (vervangt de 40+ `#0A84FF` plekken).

**Reden geparkeerd:** mengen met polish blokkeert polish op architectuurbeslissing. Jij hebt akkoord gegeven (Optie A, separate PR).

## 2. Dense in-row touch targets (11 items)

Vereisen wrap-pattern refactor (`<button class="-m-2 p-2"><span class="h-7 w-7">…`) om dense layout te behouden. Bumping naar h-11 zou rij-grids breken.
- `home/SyncButton.tsx:93` — info-i (h-6 w-6)
- `check-in/CheckInFlow.tsx:77` — stepper dots (h-6 w-6)
- `check-in/WeekPlanCard.tsx:317,324,355` — inline session-card actions
- `check-in/CheckInHistoryPage.tsx:124` — pencil edit in history-row
- `check-in/WeekReviewCard.tsx:301` — manual-addition remove X
- `schema/WorkoutCard.tsx:45` — "ask coach" inline link
- `dashboard/AdherenceTracker.tsx:57` — calendar-week dots
- `dashboard/DashboardPage.tsx:161` — week-strip day dots
- `settings/OnboardingWizard.tsx:126` — step pills

**Reden geparkeerd:** `<button>` bbox-vergroting via `padding + negative-margin` per case lokaal beoordeeld worden — dense layout context. Hoort bij groep 8 component-bijschaaf.

## 3. `htmlFor` ↔ `id` koppelingen

50+ velden buiten auth/onboarding missen expliciete label-koppeling. Settings/CheckIn/Schema/Goals.

**Reden geparkeerd:** systematisch werk dat naast token-convergence eigen pass verdient. Niet kritiek voor iPhone (VoiceOver vindt nabije tekst-labels alsnog op).

## 4. Typografie & radius token-discipline (groep 6)

`text-[Npx]` en `rounded-[Npx]` hardcodes (~80% van schermen) niet vervangen door `text-large-title/title1/title2/...` en `rounded-card-md/lg`.

**Reden geparkeerd:** raakt visueel veel componenten; risico op visuele regressie zonder eerst design-token convergence. Hoort bij groep 6 ná token-convergence.

## 5. Material/depth/motion polish (groep 7)

- Modal `backdrop-blur-sm` → `backdrop-blur-xl saturate-180` (Liquid Glass aesthetic).
- `prefers-reduced-transparency` media query — fallback op solid surface.
- Drop-shadows die Pulse v2 spec verbiedt: scan & verwijderen waar Pulse v2 cards bedoeld zijn.
- Motion presets standaardiseren op Apple easing curves (`cubic-bezier(0.32, 0.72, 0, 1)`).

**Reden geparkeerd:** lager-impact polish; ramped na convergence-PR.

## 6. PWA — niet aangeraakt

- 192×192 PNG icon ontbreekt in `public/`. Reference niet toegevoegd om broken-asset te vermijden.
- `purpose: "maskable"` icon ontbreekt.
- Geen `display-mode: standalone` CSS media queries (subtiele tab-bar gedrag verschillen Safari vs standalone).

**Reden geparkeerd:** asset-generatie is buiten code-scope. Aparte taak voor iconography.

## 7. Visual Viewport API (chat keyboard)

ChatInput / MiniChat-popup gebruiken `window.visualViewport` niet. Op iPhone met keyboard open kan input weggedrukt worden.

**Reden geparkeerd:** nontriviale implementatie (height-listener + container-padding adjustment); P2 in audit; eerst checken of `enterKeyHint=send` + safe-area-bottom in praktijk al voldoende is.

## 8. `'use client'` opruiming (75% van bestanden)

Niet aangeraakt — RSC-conversie is een eigen kerf, geen iOS polish.

## 9. `ui/Card` vs `ui/v2/Card` consolidatie

Twee parallelle Card-systemen. Niet aangeraakt — orthogonale refactor, eigen PR.

## 10. Recharts charts in trends/ map

Niet alle Recharts in `src/components/trends/` zijn handmatig geverifieerd op `isAnimationActive`. De CSS-blanket gate vangt CSS-transitions, maar Recharts gebruikt JS-animation die **niet** door de CSS-gate wordt geneutraliseerd. Als een chart in trends/ bestaat met inline animation, blijft die motion-active.

**Actie nodig**: grep `from 'recharts'` in `src/components/trends/` en handmatig `isAnimationActive` toevoegen indien gevonden. Niet gedaan in deze sessie omdat audit alleen `progress/` chartfiles noemde.

---

## Totaal-overzicht open werk

| Categorie | Item-count | Branch / PR |
|---|---|---|
| Token-convergence | ~250 (incl. 228 hex) | aparte PR |
| Dense touch-targets | 11 | groep 8 in deze branch óf vervolg-PR |
| htmlFor koppelingen | 50+ | groep 8 |
| Typografie/radius tokens | ~80 schermen aangerakt | groep 6 (na convergence) |
| Material/motion polish | ~10 schermen | groep 7 |
| PWA assets | 2 icons | iconography taak |
| Chat Visual Viewport | 1-2 componenten | groep 8 als nodig |
| RSC conversie | 75 files | eigen kerf |
| Card consolidatie | 1 refactor | eigen PR |
| Trends/ Recharts | ~3 files | quick-fix mogelijk in groep 8 |
