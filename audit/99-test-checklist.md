# Fase 4 — iPhone test-checklist

Branch: `ios-polish-audit` · Doel: handmatig op een echte iPhone bevestigen dat de 7 commits geen regressie veroorzaken en de iOS-blockers daadwerkelijk weg zijn. Reken op ~15 min.

## Pre-flight

- [ ] **Open op iPhone** in Safari (niet Chrome devtools mobile mode — die mist viewport/safe-area gedrag).
- [ ] Liefst test op een iPhone **mét** home-indicator (X+) en zonder (SE) als beide beschikbaar.
- [ ] Heb één keer rotated naar landscape gedaan, daarna terug.

## Group A — PWA + viewport

1. **Pinch-zoom werkt op elke pagina.** (was geblokkeerd door `maximumScale: 1`)
2. **Add to Home Screen** via Safari Share-sheet → splash is donker (`#15171F`), niet wit. Ga vanuit Home Screen open: status-bar tekst is wit en content komt tot in status-bar zone (zonder dat tekst eronder verdwijnt).
3. Open de app na ~10s zonder install in Safari → **InstallPrompt-toast verschijnt** met "Tik op Deel ↑ → Zet op beginscherm" (iOS-specifieke instructie ipv generieke "Installeer" knop).
4. Tik "Begrepen" → toast sluit en komt 14 dagen niet terug.

## Group B — safe-areas + dynamic viewport

5. **Bottom tab-bar** zit boven de home-indicator op iPhone X+ (geen overlap). Op iPhone SE heeft hij geen overdreven 28px lege strook.
6. Roteer naar **landscape** → tab bar krimpt en respecteert notch-padding aan zijkant. Inhoud van pagina staat niet onder het camera-cutout.
7. Open `/check-in` → tik "+ Toevoegen" → **`ManualAddModal` knoppen blijven boven home-indicator**. Idem voor `PlanWeekModal` en `EditWeekModal` op `/schema`.
8. Open `/chat` → input balk staat **netjes boven** tab-bar, niet erachter.
9. Scroll snel up/down → bij Safari address-bar in/uit-zoom: **modals jumpen niet** (was `vh`, nu `dvh`).
10. **MiniChat FAB** blijft boven tab-bar (geen overlap), in landscape met notch ook 1rem van rechter rand.

## Group C1 — inputs no-zoom

11. Tik in elk van deze velden — **iOS zoomt niet in** op focus:
    - `/auth/login` email + password
    - `/auth/signup` alle 3 velden
    - `/settings` alle inputs (raakt INPUT_CLASSES)
    - `/check-in` reflectie textarea + plan chat input + manual-add fields
    - `/nutrition` "Wat heb je gegeten" textarea
    - `/goals` nieuw doel form
    - `/schema` workout naam in EditWeek
    - `/progress` exercise-picker zoek-input
    - Onboarding wizard alle stappen incl. doel-targetValue
12. ChatInput op `/chat` — **enter-key toont "send"** symbool op iOS-keyboard (niet "return").
13. NutritionInput textarea — idem.

## Group C2 — touch targets 44pt

14. **Sluit-X buttons** in alle 6 modals/sheets (ExplainSheet, ManualAdd, PlanWeek, EditWeek, DayDetail, MuscleDrilldown) zijn nu groter (44×44) en **makkelijker te raken** met duim.
15. **Send-buttons** in ChatInput, PlanChat, NutritionInput voelen merkbaar groter aan.
16. **Day-nav arrows** in `/nutrition` (← →) zijn 44px.
17. **Goal complete/delete** buttons in GoalCard zijn comfortabel raakbaar.

## Group C3 — modal a11y

18. Op iPad of met Bluetooth keyboard: **ESC-toets sluit** elk modal (ManualAdd, PlanWeek, EditWeek, DayDetail, MuscleDrilldown, ExplainSheet).
19. EditWeek tijdens "Opslaan…" → ESC blokkeert sluiting (in-flight save niet weg gegooid).
20. VoiceOver aan → bij openen van een modal hoort `aria-label` correct (bijv. "Toevoegen aan check-in", "Plan je week").

## Group D — forms UX + body scroll lock

21. `/auth/login` op iPhone → bij focus email-veld biedt **Apple Keychain** opgeslagen credentials aan (autoComplete=email + current-password).
22. Signup → naam-veld krijgt automatisch hoofdletter eerste karakter (autoCapitalize=words).
23. Onboarding gewicht/lengte → numeriek keyboard verschijnt automatisch (`inputMode=decimal/numeric`).
24. Open een modal → **achtergrond scrollt niet meer** als je in modal scrollt. Bij sluiten staat de pagina nog op exact dezelfde scroll-positie waar je was (geen jump).

## Group 3 — reduced-motion

25. iOS Settings → Accessibility → Motion → **Reduce Motion = ON**.
26. Refresh app → page-transities zijn **instant fades** (geen y-translate slide).
27. Open `/progress` → charts tonen **zonder slide-in animatie** (bars/lines staan direct op eindwaarde).
28. Skeleton-loading screens **pulseren niet** meer; coach-orb pulseert niet.
29. Schakel Reduce Motion uit → animaties komen terug.

## Geen regressie checks

30. Login → home → schema → workout-detail → terug. Geen layout-shifts of clipped content.
31. Open MiniChat (FAB) → typ vraag → response stream zichtbaar.
32. Push een check-in workflow tot in dialog-stap → confirm.
33. Open MoreSheet (mobile nav "Meer" tab) → opent over content; tap buiten sluit; ESC sluit (op desktop).

---

## Reportage-template (kopieer naar issue/PR)

```
[ ] PWA quick-wins (1–4)
[ ] Safe areas / dvh (5–10)
[ ] Inputs no-zoom (11–13)
[ ] Touch targets (14–17)
[ ] Modal a11y (18–20)
[ ] Forms UX (21–24)
[ ] Reduced-motion (25–29)
[ ] No regressies (30–33)

Probleemgevallen:
- 
```
