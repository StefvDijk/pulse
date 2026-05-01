# Pulse UI Audit — Vercel Web Interface Guidelines

- **Datum:** 2026-05-01
- **Scope:** `src/components/**/*.tsx` (96 files) + `src/app/**/page.tsx` + `src/app/layout.tsx` (16 files)
- **Methode:** Statische audit via grep/inspectie tegen de Vercel Web Interface Guidelines (a11y, keyboard, forms, interactivity, motion, performance, safety). Geen runtime-tests; findings zijn op basis van source code patterns.

---

## P0 Critical

- src/components/chat/ChatInput.tsx:43 — FORMS/IOS-ZOOM — `<textarea>` gebruikt `text-body` (vermoedelijk <16px); op iOS triggert dit auto-zoom bij focus. — Forceer minimaal 16px font-size op alle text inputs (bijv. `text-base` of `text-[16px]`).
- src/components/check-in/ManualAddModal.tsx:64,146,160,173,188,201,244 — FORMS/IOS-ZOOM — Inputs/textarea op `text-sm` (14px). Veroorzaakt zoom op iOS. — Verhoog naar 16px op mobile (`text-base`).
- src/components/check-in/EditReviewForm.tsx:120,135,150 — FORMS/IOS-ZOOM — `text-sm` op textareas/inputs. — Idem, 16px minimum.
- src/components/check-in/PreviousFocusBlock.tsx:62 — FORMS/IOS-ZOOM — `text-sm` input. — Idem.
- src/components/check-in/PlanChat.tsx:167 — FORMS/IOS-ZOOM — Textarea `text-[13px]`. — Idem.
- src/components/check-in/WeekReflectionBlock.tsx:32 — FORMS/IOS-ZOOM — Textarea `text-[15px]`. — Forceer 16px.
- src/components/settings/SettingsPage.tsx:188-397 — FORMS/IOS-ZOOM — Alle inputs via `INPUT_CLASSES` met `text-[14px]`. — Verhoog naar 16px in `INPUT_CLASSES`.
- src/components/settings/OnboardingWizard.tsx:42 — FORMS/IOS-ZOOM — Lokale `INPUT_CLASSES` met `text-sm`. — Verhoog naar 16px.
- src/components/settings/CoachingMemoryEditor.tsx:68,215 — FORMS/IOS-ZOOM — Textarea + search input op `text-sm`. — Idem.
- src/components/settings/AIContextSection.tsx:38 — FORMS/IOS-ZOOM — Textarea kleine font-size. — Idem.
- src/components/goals/GoalForm.tsx:27,85,128,141,154 — FORMS/IOS-ZOOM — `INPUT_CLASSES` met `text-sm`. — Idem.
- src/components/schema/SchemaExerciseList.tsx:60,69,80 — FORMS/IOS-ZOOM — Inputs `text-sm`. — Idem.
- src/components/schema/EditWeekModal.tsx:198 — FORMS/IOS-ZOOM — Input `text-sm`. — Idem.
- src/components/schema/PlanWeekModal.tsx:165,172 — FORMS/IOS-ZOOM — Inputs `text-xs`. — Idem.
- src/components/check-in/WeekPlanCard.tsx:162,168,219,638 — FORMS/IOS-ZOOM — Tijd/inputs <16px. — Idem.
- src/components/progress/ExercisePicker.tsx:62 — FORMS/IOS-ZOOM — Search input `text-sm`. — Idem.
- src/components/nutrition/NutritionInput.tsx:87 — FORMS/IOS-ZOOM — Textarea `text-sm`. — Idem.
- src/app/auth/login/page.tsx:51,66 — FORMS/IOS-ZOOM — Inputs `text-sm`. — Verhoog naar 16px (auth = high-priority flow).
- src/app/auth/signup/page.tsx:56,71,86 — FORMS/IOS-ZOOM — Idem.
- src/app/auth/login/page.tsx:45-66 — FORMS/AUTOCOMPLETE — Email input mist `autoComplete="email"`, password mist `autoComplete="current-password"`, geen `inputMode`. — Voeg toe; helpt password managers en mobile keyboard.
- src/app/auth/signup/page.tsx:52-86 — FORMS/AUTOCOMPLETE — Mist `autoComplete="name"`, `email`, `new-password`. — Voeg toe.
- src/components/settings/SettingsPage.tsx:197,209,326,341,351,361 — FORMS/INPUTMODE — `type="number"` voor gewicht/lengte zonder `inputMode="decimal"` of `numeric`. — Voeg `inputMode="decimal"` toe voor mobile numpad.
- src/components/check-in/ManualAddModal.tsx:59,141,155,168,182,196 — FORMS/INPUTMODE — Numerieke vitals zonder `inputMode`. — Voeg `inputMode="decimal"` toe.
- src/components/goals/GoalForm.tsx:129 — FORMS/INPUTMODE — Streefwaarde number-input zonder `inputMode`. — Idem.
- src/components/schema/SchemaExerciseList.tsx:65,76 — FORMS/INPUTMODE — Sets/reps inputs. — Voeg `inputMode="numeric"`.
- src/components/settings/OnboardingWizard.tsx:167-200,270 — FORMS/INPUTMODE — Numerieke onboarding inputs. — Idem.
- src/components/settings/SettingsPage.tsx:243,255,383,393 — FORMS/AUTOCOMPLETE — API key/token velden hebben deels `autoComplete="new-password"` (alleen 388,397); andere password-typed velden missen autocomplete. — Standaardiseer naar `autoComplete="off"` of `new-password` voor secrets.
- src/components/check-in/CheckInFlow.tsx:202,244 — A11Y/HEADING-ORDER — Twee `<h1>` in dezelfde flow (step header + main). — Eén `<h1>` per route; verlaag de tweede naar `<h2>`.
- src/components/check-in/EditReviewForm.tsx:103 — A11Y/HEADING-ORDER — `<h1>` in component dat al onder een page-`<h1>` kan vallen. — Verifieer; gebruik `<h2>` als pagina al een hoofd-h1 heeft.
- src/components/chat/ChatMessage.tsx:18 — A11Y/HEADING-ORDER — Markdown-rendered `<h1>` per message kan meerdere h1's per pagina veroorzaken. — Map markdown headings naar `<h2>`+ binnen chat.
- src/components/schema/DayDetailSheet.tsx:60 — A11Y/KEYBOARD — Backdrop `<div onClick={onClose}>` zonder keyboard handler en sheet zonder Escape-listener / `role="dialog"` / `aria-modal`. — Voeg Escape handler en dialog rol toe; backdrop button-role of focus trap.
- src/components/schema/SchemaCalendar.tsx:96 — A11Y/KEYBOARD — Idem clickable backdrop. — Idem.
- src/components/schema/EditWeekModal.tsx — A11Y/MODAL — Geen Escape handler, geen `role="dialog"`/`aria-modal`. — Voeg toe.
- src/components/schema/PlanWeekModal.tsx — A11Y/MODAL — Idem. — Idem.
- src/components/check-in/ManualAddModal.tsx:262 — A11Y/MODAL — Modal zonder Escape handler en zonder `role="dialog"`/`aria-modal`. — Voeg toe.
- src/components/shared/InstallPrompt.tsx:73 — A11Y/MODAL — `role="dialog"` aanwezig maar geen `aria-modal` en geen Escape handler. — Voeg `aria-modal="true"` + Escape.

## P1 High

- src/components/check-in/WeekPlanCard.tsx:317,324,355 — A11Y/TOUCH-TARGET — Icon-only buttons 24-28px (h-6/h-7), onder 44px minimum. — Vergroot naar 44×44 of vergroot tap-area met padding.
- src/components/check-in/WeekReviewCard.tsx:301 — A11Y/TOUCH-TARGET — `h-6 w-6` button. — Idem.
- src/components/goals/GoalCard.tsx:136,143 — A11Y/TOUCH-TARGET — `h-7 w-7` edit/delete buttons. — Idem.
- src/components/schema/DayDetailSheet.tsx:76 — A11Y/TOUCH-TARGET — `h-7 w-7` close button. — Idem.
- src/components/explain/ExplainSheet.tsx:66 — A11Y/TOUCH-TARGET — `h-8 w-8` close. — Vergroot naar 44×44.
- src/components/check-in/ManualAddModal.tsx:284 — A11Y/TOUCH-TARGET — `h-8 w-8` close. — Idem.
- src/components/dashboard/MuscleDrilldownSheet.tsx:120 — A11Y/TOUCH-TARGET — `h-8 w-8` close. — Idem.
- src/components/schema/PlanWeekModal.tsx:104 — A11Y/TOUCH-TARGET — `h-8 w-8`. — Idem.
- src/components/schema/EditWeekModal.tsx:151 — A11Y/TOUCH-TARGET — `h-8 w-8`. — Idem.
- src/components/nutrition/NutritionInput.tsx:92 — A11Y/TOUCH-TARGET — `h-8 w-8` submit button. — Vergroot.
- src/components/chat/ChatInput.tsx:60 — A11Y/TOUCH-TARGET — `h-9 w-9` send button (36px). — Vergroot naar 44px.
- src/components/check-in/WeekPlanCard.tsx:317,324,355 — A11Y/ARIA-LABEL — Icon-only buttons mogelijk zonder aria-label (verifieer). — Voeg aria-label toe.
- src/components/goals/GoalCard.tsx:136,143 — A11Y/ARIA-LABEL — Edit/delete icon-buttons; controleer aria-label. — Voeg toe.
- src/components/schema/DayDetailSheet.tsx:76 — A11Y/ARIA-LABEL — Close button. — Voeg `aria-label="Sluiten"`.
- src/components/schema/PlanWeekModal.tsx:104, EditWeekModal.tsx:151, ExplainSheet.tsx:66, ManualAddModal.tsx:284, MuscleDrilldownSheet.tsx:120 — A11Y/ARIA-LABEL — Verifieer aria-label op close buttons. — Voeg toe waar ontbrekend.
- src/components/settings/shared.tsx:66 — A11Y/FOCUS — `INPUT_CLASSES` heeft alleen `outline-none` zonder vervangende focus-ring. — Voeg `focus-visible:ring-2 focus-visible:ring-[#0A84FF]/40` toe.
- src/components/settings/OnboardingWizard.tsx:42,262,277,284 — A11Y/FOCUS — `outline-none` zonder vervanging. — Idem.
- src/components/check-in/ManualAddModal.tsx:64,146,160,173,188,201,244 — A11Y/FOCUS — Inputs zonder visibele focus-ring. — Voeg `focus:border` of `focus-visible:ring`.
- src/components/schema/PlanWeekModal.tsx:165,172 — A11Y/FOCUS — `outline-none` only. — Idem.
- src/components/chat/ChatInput.tsx:52 — A11Y/FOCUS — Textarea `outline-none` zonder fallback (container heeft geen focus-styling). — Voeg focus-ring binnen container.
- src/components/progress/ExercisePicker.tsx:62 — A11Y/FOCUS — Search input `outline-none` zonder vervanging. — Idem.
- src/components/nutrition/NutritionInput.tsx:87 — A11Y/FOCUS — Textarea `outline-none`. — Idem.
- src/components/goals/GoalForm.tsx:27 — A11Y/FOCUS — `INPUT_CLASSES` `outline-none`. — Idem.
- src/components/settings/SettingsPage.tsx:188-397 — A11Y/LABEL-FOR — Inputs zonder `id` en label zonder `htmlFor`; project-breed gebruiken slechts 10 `htmlFor` matches op ~50 inputs. — Geef elke input een `id` en koppel via `htmlFor` (of wrap input in `<label>`).
- src/components/settings/OnboardingWizard.tsx:155-279 — A11Y/LABEL-FOR — Labels zonder `htmlFor`. — Idem.
- src/components/check-in/ManualAddModal.tsx:58-244 — A11Y/LABEL-FOR — Labels zonder htmlFor association. — Idem.
- src/components/check-in/EditReviewForm.tsx:114-150 — A11Y/LABEL-FOR — Idem. — Idem.
- src/components/check-in/WeekReflectionBlock.tsx:25 — A11Y/LABEL — Textarea zonder zichtbaar/aria label. — Voeg `aria-label` of label toe.
- src/components/check-in/PreviousFocusBlock.tsx:56 — A11Y/LABEL — Idem. — Idem.
- src/components/check-in/PlanChat.tsx:155 — A11Y/LABEL — Textarea zonder label. — Voeg aria-label.
- src/components/check-in/CoachAnalysisCard.tsx:182 — A11Y/LABEL — Idem. — Idem.
- src/components/chat/ChatInput.tsx:43 — A11Y/LABEL — Textarea zonder visible label/aria-label (placeholder is geen label). — Voeg `aria-label="Chat bericht"`.
- src/components/nutrition/NutritionInput.tsx:79 — A11Y/LABEL — Idem. — Idem.
- src/components/settings/AIContextSection.tsx:38 — A11Y/LABEL — Textarea label-koppeling onbekend. — Verifieer + koppel.
- src/components/settings/CoachingMemoryEditor.tsx:215 — A11Y/LABEL — Search input zonder label. — Voeg `aria-label="Zoeken"`.
- src/components/settings/SettingsPage.tsx:221 — A11Y/LABEL — `<select>` zonder gekoppeld label. — Voeg htmlFor.
- src/components/goals/GoalForm.tsx:99,112 — A11Y/LABEL — Selects zonder htmlFor. — Idem.
- src/components/settings/OnboardingWizard.tsx:259 — A11Y/LABEL — Select zonder label. — Idem.
- src/components/check-in/PlanChat.tsx:158 — A11Y/KEYBOARD — onKeyDown handler zonder Escape support; chat sheet kan modal-achtig zijn. — Verifieer en voeg Escape toe waar van toepassing.
- src/components/dashboard/MuscleDrilldownSheet.tsx:72-76 — A11Y/MODAL — Heeft Escape handler maar geen `role="dialog"`/`aria-modal`. — Voeg dialog rol toe.
- src/app/auth/login/page.tsx:36 / signup/page.tsx:43 — A11Y/HEADING — `<h1>Pulse</h1>` is brand, niet pagina-titel; "Inloggen"/"Registreren" zijn h2. — Maak page action de h1.
- src/components/dev/* (dev/explain/page.tsx:6) — A11Y/HEADING — h1 22px (klein) — informatief, OK voor dev page maar niet visueel hierarchisch.
- src/components/home/WorkoutFeedCard.tsx:73, ActivityCard.tsx:89 — A11Y/HEADING-ORDER — `<h3>` direct in feed zonder voorafgaande h2 binnen kaart-context. — Verifieer; pagina heeft h1+h2 dus h3 is OK mits hierarchie klopt.

## P2 Medium

- src/components/check-in/ManualAddModal.tsx, EditReviewForm.tsx, PlanWeekModal.tsx, EditWeekModal.tsx, DayDetailSheet.tsx, ManualAddModal.tsx — PERF/CLIENT — Hele modals/sheets zijn client components terwijl alleen interactieve sub-elementen client hoeven zijn. — Splits presentatie van interactie waar mogelijk; behoud current pragma als interactie domineert.
- src/components/dashboard/DashboardPage.tsx, ProgressPage.tsx, GoalsPage.tsx — PERF/CLIENT — Pages volledig client; data-fetching kan deels server. — Overweeg RSC + client islands.
- 108/145 .tsx files met `'use client'` (≈75%). — PERF/CLIENT — Hoge ratio. — Audit per bestand of client echt nodig is; veel kaarten zijn pure presentatie en kunnen RSC zijn.
- src/components/* — MOTION/REDUCED-MOTION — 118 animate-/transition-instances; slechts 1 (`CoachOrb.tsx:50`) respecteert `motion-reduce`. — Voeg `motion-reduce:transition-none motion-reduce:animate-none` toe of gebruik media query in tailwind config.
- src/components/goals/Confetti.tsx — MOTION/REDUCED-MOTION — Confetti animatie zonder reduced-motion bypass. — Skip animatie als `prefers-reduced-motion`.
- src/components/shared/ExerciseImage.tsx:30 — A11Y/ALT — `alt={name}` is acceptabel maar overweeg `alt=""` als afbeelding decoratief naast tekst. — Verifieer context.
- src/components/schema/DayDetailSheet.tsx:60, SchemaCalendar.tsx:96 — INTERACTIVITY/SEMANTIC — Backdrop is `<div onClick>`; geen `<button>` of keyboard. — Maak `<button>` of voeg `role="button"` + `tabIndex` + key handler toe (of accepteer dat Escape primaire close is, en label backdrop `aria-hidden`).
- src/components/check-in/CheckInHistoryPage.tsx:174 — A11Y/HEADING — h1 `text-headline` is visueel klein (mogelijk niet duidelijk hoofdtitel). — Vergroot of verifieer.
- src/components/chat/ChatInput.tsx:58 — A11Y/AUTOFOCUS — `autoFocus` op chat textarea kan onverwachts schermlezers verplaatsen. — Overweeg conditioneel of weghalen.
- src/components/settings/SettingsPage.tsx:243,255,383,393 — FORMS/AUTOCOMPLETE — API tokens als `type="password"` zonder bijbehorende `autoComplete="off"` — risico dat browser ze als password opslaat. — Voeg `autoComplete="off"` of `one-time-code`.
- src/components/check-in/WeekPlanCard.tsx:162,168 — FORMS/TYPE — Tijd-inputs zonder `type="time"` (gokken op text). — Verifieer; gebruik `type="time"` voor native picker.
- src/components/check-in/WeekPlanCard.tsx:638 — FORMS/TYPE — Verifieer correcte input type (datum/tijd). — Idem.
- src/components/goals/GoalForm.tsx:154 — FORMS/TYPE — Deadline input zonder `type="date"`. — Voeg toe.
- src/components/check-in/EditReviewForm.tsx:129 — FORMS — Input zonder type-attribuut (default text); verifieer of date/number nodig is. — Verifieer.
- src/components/explain/ExplainSheet.tsx:20-37 — A11Y/MODAL — Heeft Escape + role="dialog" + aria-modal: GOOD. Mist focus-trap. — Voeg focus-trap (eerste focus → close button, cycle binnen sheet).
- src/components/dashboard/MuscleDrilldownSheet.tsx — A11Y/MODAL — Heeft Escape; mist focus-trap. — Idem.
- src/components/layout/Navigation.tsx:135 — A11Y/MODAL — Heeft `role="dialog"` + `aria-modal`; verifieer Escape + focus-trap. — Voeg toe indien afwezig.
- src/components/shared/InstallPrompt.tsx:73 — A11Y/MODAL — Mist focus-trap. — Voeg toe.
- src/components/check-in/CheckInFlow.tsx:256 — FORMS — Input zonder type (default text); verifieer. — Verifieer.
- src/components/settings/SettingsPage.tsx:188 — FORMS/TYPE — Display-name input default text zonder `autoComplete="name"`. — Voeg autoComplete + id toe.
- src/components/settings/OnboardingWizard.tsx:156 — FORMS/AUTOCOMPLETE — Naam input mist `autoComplete="name"`. — Idem.
- src/app/auth/signup/page.tsx:52 — FORMS/AUTOCOMPLETE — Naam input mist `autoComplete="name"`. — Voeg toe.
- src/components/home/SyncButton.tsx:92 — A11Y — Heeft aria-label: GOOD. — N/A.
- src/components/layout/MiniChat.tsx:47,65 — A11Y — Heeft aria-labels: GOOD. — N/A.
- src/components/shared/ErrorAlert.tsx — A11Y/LIVE-REGION — Verifieer of error UI `role="alert"` of `aria-live` heeft (niet aangetroffen in grep). — Voeg `role="alert"` toe.
- src/app/auth/login/page.tsx:75, signup/page.tsx — A11Y/LIVE-REGION — Error `<p>` zonder `role="alert"`. — Voeg toe.
- src/components/chat/ChatMessage.tsx — PERF/MARKDOWN — Markdown render levert h1-h6 inline; verifieer geen XSS via `dangerouslySetInnerHTML` (geen matches gevonden — GOOD).
- src/components/goals/Confetti.tsx — PERF — Continue animatie kan zware repaint veroorzaken. — Stop na N seconden, respecteer reduced-motion.

## Tellingen

- **P0:** 33
- **P1:** 41
- **P2:** 26
- **Totaal:** 100

**Top-5 meest voorkomende rules:**
1. FORMS/IOS-ZOOM — 17 (inputs/textarea <16px → mobile zoom)
2. A11Y/LABEL of LABEL-FOR — 14 (ontbrekende label-input koppeling)
3. A11Y/FOCUS — 9 (`outline-none` zonder vervangende focus-ring)
4. A11Y/TOUCH-TARGET — 11 (icon-buttons <44px)
5. A11Y/MODAL — 9 (ontbrekende Escape / role="dialog" / aria-modal / focus-trap)

**Hotspot bestanden (>5 findings):**
- `src/components/check-in/ManualAddModal.tsx`
- `src/components/settings/SettingsPage.tsx`
- `src/components/settings/OnboardingWizard.tsx`
- `src/components/check-in/WeekPlanCard.tsx`
- `src/components/schema/*` (PlanWeekModal, EditWeekModal, DayDetailSheet, SchemaExerciseList)

**Quick wins (groot effect, weinig werk):**
1. Globale `INPUT_CLASSES` aanpassen: `text-base` (16px) + `focus-visible:ring-2 focus-visible:ring-[#0A84FF]/40` → fixt P0 iOS-zoom + P1 focus in één edit voor settings/goals/onboarding.
2. Auth pages voorzien van `autoComplete` + `inputMode` + `text-base` → fixt 6 findings.
3. Modal-pattern utility (Escape handler + `role="dialog"` + `aria-modal` + focus-trap) toepassen op ManualAddModal, EditWeekModal, PlanWeekModal, DayDetailSheet → fixt 8+ findings.
4. Globale `motion-reduce:` utility-extension in Tailwind config (of CSS @media block) → adresseert 117 motion findings in één wijziging.
