# Fase 2 — Meetbare findings (mobile-app-design scripts)

Branch: `ios-polish-audit` · Datum: 2026-05-01

## Toepasbaarheid van de scripts

De `mobile-app-design`-skill is ontworpen voor **React Native** projecten. Twee van de drie scripts zijn daarom niet 1-op-1 bruikbaar op onze Next.js/Tailwind codebase:

| Script | Toepasbaar? | Resultaat |
|---|---|---|
| `check-contrast.py` | Ja, framework-agnostisch | Hieronder: full contrast matrix |
| `validate-touch-targets.sh` | Beperkt — zoekt RN inline `width:`/`height:` props in `Pressable`/`TouchableOpacity` | 0 hits op 122 files (wij gebruiken Tailwind classes) → niet betrouwbaar als signaal. De HIG-agent (`03-hig-findings.md`) heeft touch targets via Tailwind `h-*`/`w-*` patronen handmatig gescand: ~50 violations. |
| `accessibility-audit.sh` | Niet — controleert RN-specifieke props (`accessibilityLabel`, `accessibilityRole`) | Niet uitgevoerd. Equivalent in onze stack zit in `02-vercel-findings.md` (aria-label, htmlFor, role="dialog") |

**Conclusie:** voor touch targets en a11y vertrouwen we op `02-vercel-findings.md` + `03-hig-findings.md`. Voor contrast is de Python WCAG-implementatie volledig betrouwbaar — die output staat hieronder.

## WCAG contrast matrix (afgeleid van check-contrast.py logic)

Methode: Python-implementatie van de WCAG relative-luminance formule (zoals in `check-contrast.py`). Voor `rgba()` tokens is alpha-compositing toegepast op de relevante achtergrond. Drempels: AA-text ≥ 4.5, AA-large ≥ 3.0, AAA ≥ 7.0.

### Pulse v2 — text op achtergronden (dark, default)

| Tekst-token | Background | Hex (eff.) | Ratio | AA-text | AA-large | AAA |
|---|---|---|---|---|---|---|
| `text.primary` | `bg.page` `#15171F` | `#F5F5F7` | 16.42 | ✅ | ✅ | ✅ |
| `text.secondary` | `bg.page` | `#A8A9AD` | 7.62 | ✅ | ✅ | ✅ |
| `text.tertiary` | `bg.page` | `#7C7D82` | 4.35 | ❌ | ✅ | ❌ |
| `text.muted` | `bg.page` | `#4F5057` | 2.23 | ❌ | ❌ | ❌ |
| `text.primary` | `bg.surface` `#1E2230` | `#F5F5F7` | 14.54 | ✅ | ✅ | ✅ |
| `text.secondary` | `bg.surface` | `#A8A9AD` | 6.74 | ✅ | ✅ | ❌ |
| `text.tertiary` | `bg.surface` | `#7C7D82` | 3.85 | ❌ | ✅ | ❌ |
| `text.muted` | `bg.surface` | `#4F5057` | 1.97 | ❌ | ❌ | ❌ |
| `text.primary` | `bg.elevated` `#272C3B` | `#F5F5F7` | 12.78 | ✅ | ✅ | ✅ |
| `text.secondary` | `bg.elevated` | `#A8A9AD` | 5.92 | ✅ | ✅ | ❌ |
| `text.tertiary` | `bg.elevated` | `#7C7D82` | 3.39 | ❌ | ✅ | ❌ |
| `text.muted` | `bg.elevated` | `#4F5057` | 1.73 | ❌ | ❌ | ❌ |

**P0 bevinding:** `text.tertiary` faalt AA-text op alle drie de Pulse v2 backgrounds. Alleen bruikbaar voor large text (≥18.66px regular of ≥14px bold). `text.muted` faalt overal — moet gereserveerd zijn voor non-text decoratie.

### Pulse v2 — accent/sport/status kleuren

Beoordeeld als foreground tegen `bg.page` (#15171F) en `bg.surface` (#1E2230). Relevant voor icon-only knoppen, gekleurde labels, tekst in chips.

| Token | Hex | vs `bg.page` | vs `bg.surface` | Verdict |
|---|---|---|---|---|
| `sport.gym` | `#00E5C7` | 11.10 | 9.82 | ✅ AAA |
| `sport.run` | `#FF5E3A` | 5.89 | 5.21 | ✅ AA-text, ❌ AAA |
| `sport.padel` | `#FFB020` | 9.78 | 8.66 | ✅ AAA |
| `sport.cycle` | `#9CFF4F` | 14.33 | 12.69 | ✅ AAA |
| `status.good` | `#22D67A` | 9.34 | 8.27 | ✅ AAA |
| `status.warn` | `#FFB020` | 9.78 | 8.66 | ✅ AAA |
| `status.bad` | `#FF4D6D` | 5.56 | 4.93 | ✅ AA-text (krap), ❌ AAA |
| `brand.claude` | `#D97757` | 5.73 | 5.07 | ✅ AA-text, ❌ AAA |

**P1 bevinding:** `status.bad` op `bg.surface` zit op 4.93 — net boven AA-grens. Bij gebruik op `bg.elevated` (#272C3B) komt de ratio lager uit (~4.4); risico op AA-fail bij geneste cards. Test specifiek de "warning"-states op interne kaarten.

### Apple semantic — light mode (legacy, indien per ongeluk geactiveerd)

| Token | vs `#FFFFFF` | Status |
|---|---|---|
| `label-primary` `#000000` | 21.00 | ✅ AAA |
| `label-secondary` `rgba(60,60,67,0.6)` → `#8A8A8E` | 3.44 | ❌ AA-text, ✅ AA-large |
| `label-tertiary` `rgba(60,60,67,0.3)` → `#C4C4C6` | 1.74 | ❌ |

`label-secondary` light-mode faalt AA-text — Apple's eigen spec is hier al krap. Probleem **alleen** als light mode per ongeluk wordt getriggerd (nu blokkeert `<html className="h-full dark">` dat statisch).

### Apple semantic — dark mode

| Token | vs `surface-primary` `#1C1C1E` | Status |
|---|---|---|
| `label-primary` `#FFFFFF` | 17.01 | ✅ AAA |
| `label-secondary` (gecomposit `#98989F`) | 5.94 | ✅ AA-text, ❌ AAA |
| `label-tertiary` (gecomposit `#5A5A5E`) | 2.48 | ❌ |

`label-tertiary` faalt AA-text in dark mode. **Lijkt hetzelfde patroon als Pulse v2 `text.tertiary`** — onbruikbaar voor body text.

### Cross-set ongelukken (Pulse text.* op witte Apple bg)

Risico: een component dat `text-text-primary` (Pulse) gebruikt in een card die per ongeluk de Apple light surface erft.

| Tekst | Background | Ratio |
|---|---|---|
| `text.primary` `#F5F5F7` | `#FFFFFF` | 1.09 ❌ |
| `text.secondary` (effective `#F8F8F9`) | `#FFFFFF` | 1.06 ❌ |

Catastrofale fail als dit gebeurt — onleesbaar. Reden te meer voor de tokens-strategy review (`06-token-strategy.md`).

## Touch-target validator output

```
Files checked: 122
Files with issues: 0
Total issues: 0
```

**Niet betrouwbaar als nul-signaal**: het script zoekt inline `width=`/`height=` numerics op RN `<Pressable>`-achtige elementen. Onze stack gebruikt Tailwind classes (`h-9`, `min-h-[44px]`, etc.) en wordt door dit patroon overgeslagen. Zie `03-hig-findings.md` voor de echte handmatig-gescande touch-target violations (~50 stuks; veel `h-6`/`h-8`/`h-9` icon buttons).

## Samenvatting meetbare findings

| Categorie | Aantal P0 | P1 | P2 |
|---|---|---|---|
| Contrast — text token | 1 (text.tertiary fail AA-text) | 1 (status.bad krap op elevated) | 1 (text.muted misbruik) |
| Contrast — accent/sport | 0 | 0 | 0 |
| Contrast — cross-set risico | 1 (Pulse text op Apple light bg) | 0 | 0 |

**Total: 2 P0, 2 P1, 1 P2.** Hoofdactie: `text.tertiary` opnieuw kalibreren of strikt beperken tot large text. Cross-set risico verdwijnt zodra de tokens-strategy beslissing is genomen.
