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
