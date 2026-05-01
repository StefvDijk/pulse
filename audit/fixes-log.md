# Fase 3 — Fixes log

Branch: `ios-polish-audit`

## Group A — PWA standalone + viewport baseline

**Datum:** 2026-05-01 · **Commit:** (pending)

### Wijzigingen

| File | Wat | Waarom (audit-ref) |
|---|---|---|
| `public/manifest.json` | `theme_color` + `background_color`: `#F2F2F7` → `#15171F` | `05-ios-safari-findings.md` §3 P0: lichte splash-flash op donkere app |
| `src/app/layout.tsx:16` | `appleWebApp.statusBarStyle`: `'default'` → `'black-translucent'` | `05` §3 P0: dark theme + content tot in status bar (vereist `viewport-fit:cover`, al aanwezig) |
| `src/app/layout.tsx:25-31` | `viewport.maximumScale: 1` verwijderd | `05` §1 P1 / WCAG 1.4.4: blokkeerde pinch-zoom |
| `src/components/shared/InstallPrompt.tsx` | iOS-detectie + tutorial-toast als `beforeinstallprompt` niet komt na 8s op iOS Safari. Geen library — eigen UA-check + iPadOS-edge-case (Mac UA + touch). | `05` §3 P0: iOS users kregen nooit een install-hint |

### Niet gedaan (bewust)
- 192x192 PNG en `purpose: "maskable"` icon: bron-asset niet aanwezig in `public/`. Follow-up needed (genereer assets).

### Verificatie
- `npx tsc --noEmit` → exit 0, geen type errors.
- Geen runtime test nodig voor Group A (config + één UI-toggle die enkel zichtbaar is buiten standalone).

### Vercel WIG re-run delta
Group A raakt geen UI-codepatronen die nieuw findings opleveren in Vercel WIG. InstallPrompt had al `role="dialog"`, behoudt dat. Geen nieuwe icon-only buttons of inputs toegevoegd.

---

## Group B — iOS safe-area + dynamic viewport + body-scroll-lock

**Datum:** 2026-05-01 · **Commit:** (pending)

### Nieuwe shared utility
- `src/hooks/useBodyScrollLock.ts` — iOS-safe scroll lock (gebruikt `position: fixed` + scroll-restore patroon, niet alleen `overflow:hidden` dat op iOS niet voldoende is).
- `body { --nav-height: calc(58px + env(safe-area-inset-bottom)); }` in `globals.css` — single source of truth voor mobiele tab-bar hoogte. Op `lg:` gereset naar 0px.

### Wijzigingen

| File | Wat | Audit-ref |
|---|---|---|
| `src/app/globals.css` | `--nav-height` CSS var introduceert op `body`; lg-override naar 0 | 05 §1 P1 |
| `src/components/layout/Navigation.tsx` | Tab bar `h-[86px] pb-[28px]` → `h-[var(--nav-height)] pb-[max(env(safe-area-inset-bottom),12px)]` + landscape `pl/pr-[env(...)]` | 05 §1 P1 |
| `src/app/layout.tsx` | `<main>` `pb-[86px]` → `pb-[var(--nav-height)]`; landscape `pl/pr-[env(...)]` toegevoegd | 05 §1 P1 |
| `src/components/chat/ChatPage.tsx` | `h-[calc(100dvh-86px)]` → `h-[calc(100dvh-var(--nav-height))]` | 05 §1 P2 |
| `src/components/check-in/ManualAddModal.tsx` | `90vh`→`90dvh`, `pb-[env(safe-area-inset-bottom)]`, `useBodyScrollLock(true)` | 05 §1 P0, §2.5 P1 |
| `src/components/schema/PlanWeekModal.tsx` | `90vh`→`90dvh`, sticky footer `pb-[max(1rem,env(safe-area-inset-bottom))]`, scroll-lock | 05 §1 P0 (sticky footer), §2.5 |
| `src/components/schema/EditWeekModal.tsx` | Idem | 05 §1 P0, §2.5 |
| `src/components/schema/DayDetailSheet.tsx` | `80vh`→`80dvh`, `pb-[env(...)]`, scroll-lock | 05 §1 P0 |
| `src/components/dashboard/MuscleDrilldownSheet.tsx` | `85vh`→`85dvh`, `pb-[env(...)]`, scroll-lock | 05 §1 P0 |
| `src/components/schema/SchemaCalendar.tsx` | RescheduleMenu `pb-[env(...)]` + scroll-lock | 05 §1 P0 |
| `src/components/explain/ExplainSheet.tsx` | `85vh`→`85dvh`, `pb-[env(...)]` op mobile, ad-hoc `body.style.overflow` vervangen door `useBodyScrollLock` | 05 §1 P0, §2.5 |
| `src/components/layout/MiniChat.tsx` | `bottom-24` → `calc(var(--nav-height)+1rem)`, right `max(1rem,env(safe-area-inset-right))` | 05 §1 P2 |
| `src/components/shared/InstallPrompt.tsx` | `bottom-[100px]` → `calc(var(--nav-height)+1rem)` | 05 §1 P2 |

### Niet aangeraakt (bewust)
- Navigation More-sheet had al `pb-[max(env(safe-area-inset-bottom),24px)]` ✓.
- Geen kleur-hex aangepast (parkeerregel groep 6/token-convergence).
- TimeOfDayTheme, andere fixed elementen: niet relevant voor safe-area (full-screen overlay zonder content op edges).

### Verificatie
- `npx tsc --noEmit` → exit 0.

### Body-scroll-lock dekking
7 modals/sheets voorzien: ManualAddModal, PlanWeekModal, EditWeekModal, DayDetailSheet, MuscleDrilldownSheet, SchemaCalendar's RescheduleMenu, ExplainSheet. Navigation More-sheet had al eigen lock (`document.body.style.overflow`); blijft zo om scope-creep te vermijden — kan in groep D opgeruimd worden naar de hook.
