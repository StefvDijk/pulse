# Pulse — Design System & UI Specification
**Versie:** 1.1 | **Datum:** 30 maart 2026
**Palet:** Mineral | **Thema:** Light
**Doel:** Compleet design- en UI-document voor Claude Code implementatie

---

## 1. Design Filosofie

Pulse is een lichte, data-rijke sport-app. Het voelt als een kruising tussen Apple Health (witruimte, typografie), Strava (data-dichtheid, feed), en Hevy (workout detail). Maar met iets dat geen van die apps heeft: een intelligent schema-systeem dat je als personal trainer coacht.

### Kernprincipes

1. **Licht.** Warme off-white en crème achtergronden. Geen dark mode. Geen klinisch wit.
2. **Data-forward.** Getallen zijn groot en bold. Charts zijn clean. Informatie is direct leesbaar.
3. **iPhone-first.** Ontworpen op 375px breed, schaalt naar MacBook. Touch targets minimaal 44x44px.
4. **Kleur heeft betekenis.** Elke kleur representeert een sport of status. Geen decoratieve kleuren.
5. **Typografie doet het werk.** Hiërarchie via font-weight en -size, niet via borders of schaduwen.
6. **Geaard en warm.** Het Mineral palet voelt als natuurlijke materialen: steen, aarde, oxidatie. Premium zonder pretentieus.

### Anti-patronen (NIET doen)
- Geen dark mode
- Geen gradients op achtergronden of knoppen
- Geen drop shadows op kaarten (alleen subtiele borders)
- Geen rounded corners groter dan 20px (behalve de body-kaart)
- Geen emoji in de UI
- Geen animaties langer dan 300ms
- Geen paars, nergens
- Geen klinisch wit (#FFFFFF) als pagina-achtergrond (gebruik de warme off-whites)

---

## 2. Kleurenpalet — Mineral

Het Mineral palet is geïnspireerd door natuurlijke materialen: leisteen, terracotta, geoxideerd koper, verweerd hout, zand. De kleuren voelen warm en geaard op de lichte achtergrond. Elk heeft voldoende verzadiging om op te vallen in charts en badges, maar ze schreeuwen niet.

### 2.1 Sportkleuren

Elke sport heeft drie varianten: light (achtergronden, badges), base (iconen, chart fills, dots), dark (tekst op lichte achtergrond).

| Sport | Light | Base | Dark | Gevoel |
|-------|-------|------|------|--------|
| Gym | `#E6F0F0` | `#2E6F6F` | `#1A4747` | Slate teal. Kalm, sterk, gefocust. |
| Running | `#FCEEE6` | `#C2410C` | `#8C2E08` | Terracotta. Warm, aards, beweging. |
| Padel | `#FDF3E3` | `#B45309` | `#7C3A06` | Warm amber. Energiek, competitief. |
| Fietsen | `#ECF4E4` | `#4D7C0F` | `#365908` | Mos groen. Buiten, natuur, transport. |

### 2.2 Achtergronden

| Token | Hex | Gebruik |
|-------|-----|---------|
| `--bg-page` | `#F5F3EF` | Pagina achtergrond. Warm zandtint, niet klinisch. |
| `--bg-card` | `#FDFCFA` | Kaarten, modals. Net iets warmer dan wit. |
| `--bg-subtle` | `#EDEAE4` | Pills, tags, input achtergronden. Zandkleurig. |
| `--bg-hover` | `#F8F6F2` | Hover state op kaarten. |
| `--bg-active` | `#E8E4DC` | Active/pressed state. |

### 2.3 Tekst

| Token | Hex | Gebruik |
|-------|-----|---------|
| `--text-primary` | `#1C1917` | Titels, belangrijke getallen. Warm bijna-zwart. |
| `--text-secondary` | `#57534E` | Body tekst, beschrijvingen. Warm donkergrijs. |
| `--text-tertiary` | `#A8A29E` | Labels, subtitels, timestamps. |
| `--text-muted` | `#D6D3CD` | Placeholders, disabled states. |

### 2.4 Borders

| Token | Hex | Gebruik |
|-------|-----|---------|
| `--border-light` | `#E7E5E0` | Standaard kaartborder. |
| `--border-medium` | `#D4D0C8` | Hover, scheidingslijnen. |
| `--border-strong` | `#B8B4AC` | Focus states, emphasis. |

### 2.5 Status kleuren

| Status | Base | Light (achtergrond) | Dark (tekst) | Gebruik |
|--------|------|---------------------|--------------|---------|
| Positief | `#16A34A` | `#F0FDF4` | `#166534` | Op schema, target gehaald, progressie omhoog |
| Waarschuwing | `#D97706` | `#FFFBEB` | `#92400E` | Bijna op target, aandacht nodig |
| Negatief | `#DC2626` | `#FEF2F2` | `#991B1B` | Onder target, gemist, achteruitgang |

### 2.6 Spiergroep heatmap

Het 3D lichaam is donkergrijs. De glow-intensiteit op getrainde spiergroepen volgt het terracotta-spectrum:

| Niveau | Kleur | Opacity | Wanneer |
|--------|-------|---------|---------|
| Geen | Base grijs `#4A4A52` | — | Niet getraind |
| Licht | `#E6A87C` | 40% | 1-4 sets |
| Matig | `#D4845A` | 65% | 5-9 sets |
| Zwaar | `#C2410C` | 80% | 10-14 sets |
| Zeer zwaar | `#9A3412` | 90% | 15+ sets |

### 2.7 Accent / CTA

| Token | Hex | Gebruik |
|-------|-----|---------|
| `--accent` | `#1C1917` | Primaire knoppen. Warm zwart. |
| `--accent-text` | `#FDFCFA` | Tekst op primaire knoppen. |
| `--accent-secondary` | `#EDEAE4` | Secundaire knoppen. |
| `--accent-link` | `#2E6F6F` | Links en interactieve tekst. |

### 2.8 Chart kleuren

| Element | Kleur | Gebruik |
|---------|-------|---------|
| Push pattern | `#C2410C` | Terracotta |
| Pull pattern | `#2E6F6F` | Slate teal |
| Squat pattern | `#B45309` | Amber |
| Hinge pattern | `#4D7C0F` | Mos groen |
| Macro: eiwit | `#2E6F6F` | Teal |
| Macro: koolhydraten | `#B45309` | Amber |
| Macro: vet | `#C2410C` | Terracotta |

---

## 3. Typografie

**Font:** Inter (via `next/font/google`)

| Rol | Grootte | Gewicht | Tracking | Kleur |
|-----|---------|---------|----------|-------|
| Hero getal | 32px | 700 | -0.5px | `--text-primary` |
| Pagina titel | 26px | 700 | -0.5px | `--text-primary` |
| Stat getal | 24px | 700 | -0.3px | `--text-primary` |
| Sectie titel | 17px | 600 | 0 | `--text-primary` |
| Kaart titel | 15px | 600 | 0 | `--text-primary` |
| Body | 14px | 400 | 0 | `--text-secondary` |
| Label | 13px | 500 | 0 | `--text-tertiary` |
| Small label | 11px | 500 | 0 | `--text-tertiary` |
| Caption | 10px | 500 | 0.2px | `--text-tertiary` |

---

## 4. Spacing & Layout

| Context | Waarde |
|---------|--------|
| Pagina padding (horizontaal) | 16px |
| Kaart padding (intern) | 14px 16px |
| Ruimte tussen kaarten | 8px |
| Ruimte tussen secties | 16px |
| Grid gap (stat kaarten) | 8px |

### Border radius

| Element | Radius |
|---------|--------|
| Body container kaart | 20px |
| Standaard kaart | 14px |
| Pill / badge | 20px |
| Input / knop | 10px |
| Weekdag-cirkel | 50% |

### Kaarten

```css
background: #FDFCFA;
border: 0.5px solid #E7E5E0;
border-radius: 14px;
padding: 14px 16px;
/* Geen box-shadow */
```

---

## 5. Componenten

### 5.1 Bottom Navigation

5 tabs, 74px hoog. Achtergrond `#FDFCFA`, border-top `0.5px solid #E7E5E0`.
Actief: filled icoon + `#1C1917`. Inactief: outline icoon + `#D6D3CD`.

Tabs: Home (grid), Progressie (trending), Schema (clipboard), Voeding (utensils), Coach (chat).

### 5.2 Sidebar (Desktop)

220px breed, `#FDFCFA` achtergrond. Logo "Pulse" bovenaan. Actieve item: `#EDEAE4` achtergrond.

### 5.3 Weekbalk

7 cirkels, 34px diameter. Voltooid = sportkleur solid + witte label. Gepland = sportkleur border. Rust = dashed `#D6D3CD` border.

### 5.4 Knoppen

Primair: `#1C1917` achtergrond, `#FDFCFA` tekst.
Secundair: `#EDEAE4` achtergrond, `#1C1917` tekst.
Ghost: transparant, `#2E6F6F` tekst.

### 5.5 Badges

Sport: light-variant achtergrond + dark-variant tekst (bijv. gym: `#E6F0F0` bg, `#1A4747` tekst).
Status: groen/amber/rood light bg + dark tekst.

---

## 6. Tab Specificaties

### 6.1 Home
Body model (placeholder) → weekbalk → sport stats → vandaag-kaart.

### 6.2 Progressie
Periode selector → kracht chart → volume chart → running chart → PR lijst.

### 6.3 Schema
Schema overzicht met progressiebalk → workout kaarten per dag → workout detail met sets tabel → "nieuw schema" via Coach tab. Vorige schema's als historie.

### 6.4 Voeding
Dag status → eiwit tracker → macro donut → input → maaltijdenlijst.

### 6.5 Coach
Suggesties (2x2 grid) → chat berichten (markdown) → input. User rechts (#EDEAE4), assistant links (#FDFCFA + border).

---

## 7. Charts (Recharts)

Grid: `#E7E5E0`, dashed, alleen horizontaal. Assen: `#A8A29E` tekst, geen lijn. Tooltip: `#FDFCFA` achtergrond, subtle shadow. Lijndikte 2px, dot 4px alleen op hover, bar radius 4px top.

---

## 8. Responsiveness

Mobile S (375px) referentie → Mobile L (428px) → Tablet (768px, 2 kolommen) → Desktop (1024px+, sidebar).

Bottom nav op mobile, sidebar op desktop. Charts 200px op mobile, 300px op desktop. Chat max 680px breed op desktop.

---

## 9. Tailwind Implementatie

```css
@import "tailwindcss";

@theme {
  --color-bg-page: #F5F3EF;
  --color-bg-card: #FDFCFA;
  --color-bg-subtle: #EDEAE4;
  --color-bg-hover: #F8F6F2;
  --color-text-primary: #1C1917;
  --color-text-secondary: #57534E;
  --color-text-tertiary: #A8A29E;
  --color-text-muted: #D6D3CD;
  --color-border-light: #E7E5E0;
  --color-border-medium: #D4D0C8;
  --color-border-strong: #B8B4AC;
  --color-sport-gym: #2E6F6F;
  --color-sport-gym-light: #E6F0F0;
  --color-sport-gym-dark: #1A4747;
  --color-sport-run: #C2410C;
  --color-sport-run-light: #FCEEE6;
  --color-sport-run-dark: #8C2E08;
  --color-sport-padel: #B45309;
  --color-sport-padel-light: #FDF3E3;
  --color-sport-padel-dark: #7C3A06;
  --color-sport-cycle: #4D7C0F;
  --color-sport-cycle-light: #ECF4E4;
  --color-sport-cycle-dark: #365908;
  --color-status-green: #16A34A;
  --color-status-amber: #D97706;
  --color-status-red: #DC2626;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

:root { color-scheme: light; }
html { background-color: #F5F3EF; color: #1C1917; }
```

### Verwijder dark mode
Alle `style={{ backgroundColor: '#0a0a0f' }}` en vergelijkbare dark inline styles moeten weg. `class="dark"` van html verwijderen. `color-scheme` naar `light`.

---

## 10. Ontwikkelvolgorde

1. Tailwind tokens vervangen (Mineral palet, light theme)
2. Navigation updaten (5 tabs)
3. Shared components (Card, Badge, StatCard, ProgressBar)
4. Home page (body placeholder, WeekBar, SportStats, TodayCard)
5. Schema tab (SchemaOverview, WeekPlan, WorkoutDetail)
6. Progressie tab (charts, vereist Recharts + SWR)
7. Voeding tab (input + tracker, vereist AI)
8. Coach tab (chat, vereist Anthropic SDK)
