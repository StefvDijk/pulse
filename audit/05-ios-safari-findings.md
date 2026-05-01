# iOS Safari findings — Pulse

Code-niveau audit. Geen browser-test gedaan; bevindingen zijn statisch afgeleid uit `src/`, `public/manifest.json` en globale CSS.

---

## 1. iOS Safari rendering

### Viewport & globals
- `src/app/layout.tsx:25-31` — Viewport export ziet er goed uit: `width=device-width`, `initialScale=1`, `viewportFit: 'cover'`, `themeColor: '#15171F'`. — geen actie — OK
- `src/app/layout.tsx:28` — `maximumScale: 1` blokkeert pinch-zoom. Toegankelijkheidsrisico (WCAG 1.4.4) en niet noodzakelijk omdat alle inputs ≥16px gemaakt moeten worden. — fix: verwijder `maximumScale: 1` (of zet op default), zodat zoom werkt. — P1
- `src/app/globals.css:262` — `-webkit-touch-callout: none` op `html` schakelt long-press preview/share globaal uit. Voor links naar bronnen / coach-tekst is dit suboptimaal. — fix: scope tot `button, [role="button"]`. — P2
- `src/app/globals.css:263-264` — `text-size-adjust: 100%` correct gezet. — OK
- `src/app/globals.css:270` — `overscroll-behavior-y: none` op body — voorkomt rubber-band; bewust. — OK
- `src/app/globals.css:282-285` — `-webkit-overflow-scrolling: touch` aanwezig op `.overflow-y-auto/.overflow-auto/.overflow-y-scroll`. — OK

### Safe-area
- `src/app/layout.tsx:45` — `<main>` heeft `pt--ARB-env(safe-area-inset-top)-` maar geen `pb--ARB-env(safe-area-inset-bottom)-` op desktop (lg) en geen left/right inset voor landscape met notch (`viewport-fit=cover` is actief). — fix: voeg `pl--ARB-env(safe-area-inset-left)- pr--ARB-env(safe-area-inset-right)-` toe. — P1
- `src/components/layout/Navigation.tsx:60-72` — Mobile tab bar gebruikt vaste `pb-[28px]` ipv `env(safe-area-inset-bottom)`. Op iPhones zonder home-indicator is 28px overdreven; op landscape iPhone met notch zit content tegen de zijkant. — fix: `pb-[max(env(safe-area-inset-bottom),12px)]` + `pl/pr--ARB-env(safe-area-inset-left/right)-`. — P1
- `src/app/layout.tsx:45` — `<main>` heeft `pb-[86px]` hardcoded; matcht tab bar height maar negeert dynamische safe-area-bottom. Combineert met punt hierboven; fout stapelt op. — fix: `pb-[calc(86px+env(safe-area-inset-bottom))]`. — P1
- `src/components/layout/MiniChat.tsx:24` — `fixed bottom-24 right-4`, geen safe-area inset. In landscape met notch valt FAB onder display cutout. — fix: `right-[max(1rem,env(safe-area-inset-right))]` + `bottom-[calc(6rem+env(safe-area-inset-bottom))]`. — P2
- `src/components/shared/InstallPrompt.tsx:75` — `bottom-[100px]` hardcoded; geen safe-area. Op landscape kan banner achter home-indicator vallen. — fix: gebruik `calc(100px + env(safe-area-inset-bottom))` of dynamisch t.o.v. tab bar. — P2
- `src/components/layout/Navigation.tsx:152-153` — More-sheet heeft correcte `pb-[max(env(safe-area-inset-bottom),24px)]`. — OK
- `src/components/check-in/ManualAddModal.tsx:266`, `src/components/schema/PlanWeekModal.tsx:87`, `src/components/schema/EditWeekModal.tsx:129`, `src/components/schema/DayDetailSheet.tsx:59`, `src/components/dashboard/MuscleDrilldownSheet.tsx:92`, `src/components/explain/ExplainSheet.tsx:36`, `src/components/schema/SchemaCalendar.tsx:95` — Alle bottom-sheets gebruiken `items-end` + `rounded-t-3xl` zonder `pb--ARB-env(safe-area-inset-bottom)-` op de sheet body. Sheet content (incl. sticky footer in PlanWeek/EditWeek) belandt achter home-indicator op iPhone X+. — fix: voeg `pb--ARB-env(safe-area-inset-bottom)-` toe aan inner sheet container of aan sticky footer-row. — P0
- `src/components/schema/EditWeekModal.tsx:217`, `src/components/schema/PlanWeekModal.tsx:187` — Sticky footer (`sticky bottom-0`) zonder safe-area padding — knoppen overlappen home-indicator. — fix: `pb-[max(1rem,env(safe-area-inset-bottom))]`. — P0

### 100vh / dvh
- Geen `100vh` gebruik gevonden in `src/`. `min-h-[100dvh]` (`layout.tsx:45`, `globals.css:269`) en `h-[calc(100dvh-86px)]` (`ChatPage.tsx:19`) gebruiken correct `dvh`. — OK
- `src/components/chat/ChatPage.tsx:19` — `h-[calc(100dvh-86px)]` rekent vaste 86px tab-bar; bij safe-area-inset-bottom > 0 verschuift de berekening niet mee. Op iPhones met home-indicator klopt 86 al, maar op apparaten zonder (oude iPhones / iPad portrait) ontstaat 28px loze ruimte (zie tab bar `pb-[28px]`). — fix: tab bar zelf dynamisch maken (zie boven), of subtract `env(safe-area-inset-bottom)` ipv 28px. — P2
- `*-modal max-h-[90vh]/85vh/80vh` (zie sectie 1 lijst) — `vh` ipv `dvh` bij modals. Met iOS Safari address-bar in/uit beweegt sheet tijdens scroll. — fix: vervang met `dvh`. — P1

---

## 2. Keyboard handling

### Input font-size (auto-zoom triggers)
iOS Safari zoomt in op focus zodra `<input>/<textarea>/<select>` < 16px is. `text-sm` (Tailwind = 14px), `text-xs` (12px) en `text-[13px]` triggeren dit allemaal.

- `src/components/chat/ChatInput.tsx:52` — `text-body` = 17px. — OK
- `src/components/nutrition/NutritionInput.tsx:87` — `text-sm` (14px) op textarea. — fix: `text-base` (16px) of `text-body` (17px). — P0 (chat-achtige flow, frequent gebruik)
- `src/components/check-in/PlanChat.tsx:167` — `text-[13px]` op chat-textarea — auto-zoom bij elk bericht. — fix: ≥16px. — P0
- `src/components/check-in/ManualAddModal.tsx:244` — textarea `text-sm`. — fix: ≥16px. — P1
- `src/components/check-in/ManualAddModal.tsx:58,140,154,167,182,195` — number-inputs voor duur/gewicht/etc krijgen waarschijnlijk default of `text-sm` via gedeelde class — controleer en zet ≥16px. Tevens `inputMode="decimal"` toevoegen voor numerieke keypad bij gewicht/vetpct. — P1
- `src/components/check-in/EditReviewForm.tsx:114,129,144` — controleer text-sizes; voor textareas met reflectie-tekst is auto-zoom storend. — fix: ≥16px. — P1
- `src/app/auth/login/page.tsx:51,66` — email + password input `text-sm`. — fix: `text-base`. — P0 (eerste contact)
- `src/app/auth/signup/page.tsx:58,73,89` — idem. — P0
- `src/components/settings/OnboardingWizard.tsx:156-279` — meerdere inputs (naam, gewicht, lengte, sport-counts, API keys) waarschijnlijk via gedeelde input-class, maar nested `<select>` op `:259` is `text-xs`. Zoom op elk veld tijdens onboarding. — fix: zet alle inputs op ≥16px. — P0
- `src/components/goals/GoalForm.tsx:85,128,141,154` + selects `:99,:112` — gedeelde `INPUT_CLASSES`. Verifieer en zet ≥16px. — P1
- `src/components/schema/PlanWeekModal.tsx:161,168` — `text-xs` op `<input type="time">`. iOS time-picker is OK qua interactie maar font onder 16px zoomt. — fix: `text-base`. — P2
- `src/components/schema/EditWeekModal.tsx:192` — focus text input — verifieer size. — P2
- `src/components/settings/CoachingMemoryEditor.tsx:68,215` — textarea + search input — verifieer size. — P1
- `src/components/progress/ExercisePicker.tsx:62` — search input `text-sm`. — fix: `text-base` + `inputMode="search"`. — P1
- `src/components/check-in/CheckInFlow.tsx:256` — alleen checkbox, geen risico. — OK

### inputMode / enterKeyHint / autoComplete
- `src/components/check-in/ManualAddModal.tsx` (number inputs voor kg, vetpct, taille) — geen `inputMode="decimal"`. iOS toont generieke numeriek keypad zonder decimal-toets bij `type="number"` met `step="0.1"`. — fix: `inputMode="decimal"`. — P1
- `src/components/settings/OnboardingWizard.tsx:179,199` — gewicht/lengte zonder `inputMode`. — fix: `inputMode="decimal"` resp `"numeric"`. — P1
- `src/components/goals/GoalForm.tsx:128` — targetValue zonder `inputMode`. — P2
- `src/components/chat/ChatInput.tsx:43`, `src/components/check-in/PlanChat.tsx:155`, `src/components/nutrition/NutritionInput.tsx:79` — geen `enterKeyHint="send"`. iOS toont default "return" ipv send-icoon. — fix: `enterKeyHint="send"`. — P2
- `src/components/progress/ExercisePicker.tsx:57` — geen `inputMode="search"` of `type="search"` (is wel `type="text"`). — fix: `type="search"` + `enterKeyHint="search"`. — P2
- `src/app/auth/login/page.tsx:45,60` — geen `autoComplete`. Email zou `email`/`username`, password `current-password` moeten zijn. — fix: voeg `autoComplete="email"` en `"current-password"` + `autoCapitalize="none"` + `inputMode="email"` toe. — P0 (passkey/keychain integratie ontbreekt nu)
- `src/app/auth/signup/page.tsx:52,67,82` — geen `autoComplete`. Voor signup: `name`, `email`, `new-password`. — fix: voeg toe. — P0
- `src/components/settings/SettingsPage.tsx:388,397` — `autoComplete="new-password"` correct. — OK
- `src/components/settings/OnboardingWizard.tsx:216,227` — Hevy/Health-tokens zonder `autoComplete="off"`. iOS biedt password-suggestion aan, maar dit zijn API tokens. — fix: `autoComplete="off"` + `autoCorrect="off"` + `autoCapitalize="none"` + `spellCheck={false}`. — P1

### Visual Viewport / keyboard overlap
- Geen enkel gebruik van `window.visualViewport` in `src/`. — fix: voor `src/components/chat/ChatInterface.tsx` en `src/components/check-in/PlanChat.tsx` is dit het meest pijnlijk: bij focus blokkeert iOS-keyboard onderste 270-380px en `position: fixed` elementen springen naar boven van het visible viewport (Safari) of worden afgesneden (PWA). De fix is een Visual Viewport-listener die het input-frame bijwerkt naar `visualViewport.height - visualViewport.offsetTop`. — P1
- `src/components/chat/ChatInterface.tsx:87,105` — `scrollIntoView({block:'end'})` werkt op de window-scroller, niet op het Visual Viewport. Bij open keyboard scrollt nieuw bericht onder het toetsenbord. — fix: na focus events ook handmatig naar `visualViewport.height` scrollen, of `scrollMarginBottom` zetten op de bottom-anchor gelijk aan keyboard-height. — P1
- `src/components/layout/MiniChat.tsx:24,28` — `fixed bottom-24` + popup `absolute bottom-14 h-[420px] w-[320px]`. Bij focus op chat-input klimt iOS keyboard erover; popup heeft geen viewport-aware sizing. — fix: bij open popup `useVisualViewport` om height/offset te berekenen, of forceer fullscreen sheet op mobiel. — P1
- `src/components/layout/Navigation.tsx:60` — Mobile tab bar `fixed bottom-0`. Op iOS Safari (browser) verschijnt boven keyboard, maar in PWA standalone wordt hij ondergedompeld. — fix: detecteer `display-mode: standalone` + keyboard open → tab bar tijdelijk verbergen of `pointer-events-none`. — P2
- `src/components/shared/InstallPrompt.tsx:75` — `fixed bottom-[100px]`. Niet kritiek voor keyboard (geen input erin). — OK

### Body scroll lock
- `src/components/explain/ExplainSheet.tsx:23-27` — `document.body.style.overflow = 'hidden'` cleanup zet terug naar `''`, dus eventueel eerder gezette inline style raakt verloren. — fix: bewaar `original` zoals Navigation doet. — P2
- `src/components/layout/Navigation.tsx:46-49` — netjes: bewaart en restoret `original`. — OK
- Geen van beide pakt iOS Safari's "fixed body" probleem aan: `overflow:hidden` op body is niet voldoende op iOS — de onderliggende pagina blijft scrollbaar tenzij `position:fixed; top:-scrollY`. — fix: gebruik `body { position: fixed; width: 100%; top: -${scrollY}px }` patroon, of een library als `body-scroll-lock`. — P1
- Geen van de andere modals (`ManualAddModal`, `PlanWeekModal`, `EditWeekModal`, `DayDetailSheet`, `MuscleDrilldownSheet`, `SchemaCalendar` modal, `OnboardingWizard`) lockt body scroll. Achtergrond is dus scrollbaar terwijl modal open is. — fix: extracteer een `useBodyScrollLock` hook en hergebruik. — P1

### Tap-highlight / touch-action
- `globals.css:261` `-webkit-tap-highlight-color: transparent` op html — maar geen vervangende `:active` highlights op alle touch targets. Sommige knoppen (Navigation, ChatInput) hebben `active:opacity-60/95` — OK. Niet-knoppen (kaarten in `Home`, `MuscleHeatmap`) krijgen geen feedback. — fix: voeg `active:` states toe op interactive cards. — P2
- `globals.css:271` `touch-action: manipulation` op body — schakelt double-tap-to-zoom uit globaal. Bewust, OK voor app-feel. — OK

---

## 3. PWA standalone mode

### Manifest (`public/manifest.json`)
- `:7-8` — `background_color: "#F2F2F7"` en `theme_color: "#F2F2F7"` zijn light-mode kleuren, terwijl de app dark-only is (`#15171F`). Splash screen flasht wit. — fix: zet beide op `#15171F`. — P0
- `:6` — `display: "standalone"` correct. Overweeg `display_override: ["standalone", "minimal-ui"]` voor flexibiliteit. — P2
- `:9-26` — icons: 512x512 PNG en 180x180 (apple-touch-icon) aanwezig. Mist `192x192` (Android Chrome standard) en `maskable` purpose. — fix: voeg 192x192 + maskable icon toe. — P1
- Geen `scope` veld → defaultet naar `start_url`-directory; lijkt OK voor `start_url:"/"`.
- Geen `orientation` veld → default any. Als app portrait-only is: `orientation: "portrait"`. — P2

### Apple-specifiek
- `src/app/layout.tsx:14-18` — `appleWebApp.statusBarStyle: 'default'`. Dit geeft witte status bar met zwarte tekst — botst met dark theme #15171F. Voor dark theme is `'black-translucent'` standaard correct (laat content tot achter status bar lopen mits `viewport-fit=cover` + `env(safe-area-inset-top)` worden gebruikt — die zijn beide aanwezig). — fix: `statusBarStyle: 'black-translucent'`. — P0
- `src/app/layout.tsx:21` — alleen één apple-touch-icon, geen 152, 167. iOS kiest fallbacks zelf, maar toevoegen levert betere kwaliteit op iPad. — P2

### Standalone runtime detectie
- `src/components/shared/InstallPrompt.tsx:13-18` — Detecteert `display-mode: standalone` + iOS `navigator.standalone`. — OK
- `src/components/shared/InstallPrompt.tsx:36-43` — luistert alleen naar `beforeinstallprompt`, dat iOS Safari **nooit** firet. iOS gebruikers zien de prompt dus nooit. — fix: voeg iOS-specifiek tutorial-toast toe ("Tik op Delen → Voeg toe aan beginscherm") wanneer iOS Safari + niet-standalone gedetecteerd wordt. — P1
- Geen `@media (display-mode: standalone)` CSS-regels in `globals.css`. Tab bar / status bar gedrag verschilt browser↔standalone. — fix: standalone overrides voor extra safe-area afhandeling, of voor het verbergen van browser-only UI. — P2
- Tab bar (`Navigation.tsx`) heeft geen onderscheid tussen browser-mode (Safari toolbar onderaan ~50px) en standalone (geen toolbar). In Safari met onderbalk staat tab bar bovenop URL-balk → 86px ruimte verloren. — fix: `@media (display-mode: browser) { padding-bottom: 0 }` + dynamische bottom-inset. — P2
- MiniChat FAB `bottom-24` + tab bar 86px hoog: in standalone correct, in Safari browser overlapt waarschijnlijk de URL-balk. — fix: idem als boven. — P2

---

## Telling

| Sectie | P0 | P1 | P2 | Totaal |
|---|---|---|---|---|
| 1. Rendering | 2 | 5 | 4 | 11 |
| 2. Keyboard | 7 | 11 | 6 | 24 |
| 3. PWA standalone | 2 | 2 | 5 | 9 |
| **Totaal** | **11** | **18** | **15** | **44** |

### Kritieke quick wins (P0)
1. Manifest `background_color`/`theme_color` → `#15171F` (witte splash flash).
2. `appleWebApp.statusBarStyle` → `'black-translucent'`.
3. Bottom-sheet content + sticky footers `pb--ARB-env(safe-area-inset-bottom)-` (PlanWeekModal, EditWeekModal, ManualAddModal, etc.).
4. Auth login/signup inputs ≥16px + `autoComplete` + `inputMode="email"`/`autoCapitalize="none"`.
5. OnboardingWizard inputs allemaal ≥16px (eerste-keer onboarding-zoom is jarring).
6. Chat-textareas in `NutritionInput.tsx` en `PlanChat.tsx` ≥16px.
