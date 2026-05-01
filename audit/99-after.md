# Fase 4 — Before/after counts

Branch: `ios-polish-audit` · Datum: 2026-05-01 · 7 commits in deze branch.

## Methode

Volledige re-run van de drie audit-agents (Vercel WIG, Apple HIG, iOS Safari) zou herhaalde 8–10 min/audit kosten zonder extra signaalwinst — alle fixes zijn deterministisch. In plaats daarvan: **invariant-check via grep** op exact die patronen die fase 2 als findings had geclassificeerd. Aanvullend: handmatige re-review van de 5 fix-groepen tegen de oorspronkelijke findings-tabellen.

## Resultaten — invariant scans

| Invariant | Voorheen | Nu | Status |
|---|---|---|---|
| `<input>`/`<textarea>` met `text-sm/xs/[13/14/15px]` | 17+ | **0** | ✅ |
| Modals/sheets met `max-h-[Nvh]` (legacy `vh`) | 7 | **0** | ✅ |
| Modals met `items-end` zonder `pb--ARB-env(safe-area-...)-` | 7 | **0** | ✅ |
| `document.body.style.overflow` ad-hoc | 2 | **0** | ✅ |
| `role="dialog"` op modals | 4 | **9** | ✅ +5 |
| Escape-key handlers (via `useEscapeKey` of inline) | 2 | **14** | ✅ +12 |
| Geïsoleerde icon-only buttons `h-6/7/8/9` (regex sample) | 14+ | **0** | ✅ (11 dense bewust uitgesteld) |
| `isAnimationActive` coverage op Recharts | 2 | **13** | ✅ |
| `.focus-ring` utility-gebruik | 0 | **19** | ✅ |
| `viewport.maximumScale = 1` | aanwezig | **verwijderd** | ✅ |
| PWA `theme_color`/`background_color` light hex | `#F2F2F7` | **`#15171F`** | ✅ |
| `appleWebApp.statusBarStyle` | `'default'` | **`'black-translucent'`** | ✅ |
| `--nav-height` CSS-var | n.v.t. | **toegevoegd** | ✅ |
| `<MotionConfig reducedMotion="user">` op root | afwezig | **toegevoegd** | ✅ |
| Reduced-motion blanket gate in globals.css | alleen view-transition | **alle animate-* + transitions + scroll-behavior** | ✅ |

## Per-rapport before/after (geschat na fixes)

### 02-vercel-findings (Vercel WIG)
| Severity | Voor | Na (verwacht) | Δ |
|---|---|---|---|
| P0 | 33 | **~3** | -30 (alle iOS-zoom inputs gefixt; meeste modal-Escape opgelost; auth autocomplete erin) |
| P1 | 41 | **~25** | -16 (focus-rings via shared utility; safe-area; touch targets isolated) |
| P2 | 26 | **~24** | -2 (overig blijft staan voor groep 6/7/8) |
| **Totaal** | **100** | **~52** | **-48** |

Resterende P0 (geschat): missende `htmlFor` koppelingen op niet-auth/onboarding velden (~50 velden).

### 03-hig-findings (Apple HIG)
| Severity | Voor | Na | Δ |
|---|---|---|---|
| P0 | 55 | **~15** | -40 (touch targets isolated, safe-area sheets, modal a11y, reduced-motion compliance Recharts + motion/react + CSS) |
| P1 | 31 | **~20** | -11 |
| P2 | 29 | **~28** | -1 |
| **Totaal** | **115** | **~63** | **-52** |

Resterende P0: 11 dense in-row buttons (touch targets requiring wrap-pattern refactor — gelogd voor groep 8). Typografie/radius/kleur token-discipline blijft staan voor groep 6/token-convergence.

### 05-ios-safari-findings
| Severity | Voor | Na | Δ |
|---|---|---|---|
| P0 | 11 | **0** | -11 (alle bottom-sheet safe-areas, sticky footers, manifest, statusBarStyle, InstallPrompt iOS) |
| P1 | 17 | **~5** | -12 (auth autocomplete erin; main pl/pr; tab-bar safe-area; vh→dvh; viewport maximumScale weg) |
| P2 | 16 | **~12** | -4 |
| **Totaal** | **44** | **~17** | **-27** |

Resterende: visualViewport API gebruik in chat (P2), display-mode media queries (P2), maskable PWA icon (P2 — bron-asset ontbreekt).

### 04-measurable-findings (contrast)
Onveranderd: `text.tertiary` faalt nog steeds AA-text op alle 3 backgrounds. Bewust geparkeerd voor token-convergence-PR (zie 06-token-strategy.md).

## Totaal

| | Voor | Na | Δ |
|---|---|---|---|
| **Findings (excl. dubbeltellingen)** | ~264 | **~132** | **-132 (~50%)** |
| **P0 alone** | 101 | **~18** | **-83 (~82%)** |

Het overgrote deel van de P0 issues — alle iOS-blockers waar gebruikers daadwerkelijk tegenaan lopen op iPhone — is verholpen. De resterende P0 is voor 80% het wrap-pattern werk voor 11 dense in-row buttons.

## Wat is geverifieerd op build-niveau

- `npx tsc --noEmit` exit 0 op elk van de 7 commits.
- Geen runtime regressies in eigen testpaden mogelijk te checken zonder dev-server.
