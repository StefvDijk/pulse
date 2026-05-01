# Sprint 1 — Daily Ritual

**Bron:** `research/opportunities.md` (tickets #1, #8, #9)
**Thema:** Maak van Pulse een app die het waard is om elke ochtend te openen — één hero number, eerlijke uitleg, juiste toon.
**Sprint-omvang:** klein. Drie tickets, samen ~1-2 dagen werk. Allemaal client-side / config — geen migraties, geen nieuwe AI-laag.

---

## Ticket P1-1 — Hero readiness op home + "Why?" drill-down

**Score:** 11.3 (hoogste van alle 15 opportunities)
**Omvang:** M
**Files vermoedelijk geraakt:** `src/components/home/HomeHero.tsx`, `src/components/home/ReadinessSignal.tsx` (groot maken), nieuwe `ReadinessDrilldown.tsx` (modal/sheet), evt. nieuwe API endpoint `/api/readiness/contributors`.

### Acceptatiecriteria

1. Bovenaan home (boven alles behalve eventuele coach-orb) staat één **hero readiness module**:
   - Grote score (XXL typografie, ~96px)
   - Eén werkwoord/label ("Goed hersteld" / "Klaar om te trainen" / "Vermoeid" / "Rustdag")
   - Eén korte zin context (1 regel, b.v. "HRV is 8% onder je 14d-baseline")
   - Statuskleur volgens design system v2
2. Tap op hero → opent **drill-down sheet** met contributors:
   - HRV (waarde + delta vs personal baseline + bandvisualisatie)
   - Sleep (duur + efficiency indien beschikbaar + delta)
   - Workload (acute:chronic ratio + zone)
   - Soreness (uit laatste check-in indien <72u oud)
   - Per contributor: pijl/percentage hoeveel het bijdraagt aan de score (positief/negatief)
3. Bestaande `ReadinessSignal` component blijft als kleinere variant beschikbaar (b.v. voor andere schermen of widget-pagina later) of wordt gerefactored naar een `<size="hero" | "compact">` prop.
4. Werkt op mobiel (sheet komt van onder), desktop (modal centered), respecteert `useReducedMotion`.

### Niet in scope (parkeren voor later)

- iOS widget / watch complication (#14, eigen sprint)
- Push notification op ready-state (#5)
- AI-tekst onder de score ("Wat betekent dit voor je dag?") — dat is ticket P2-1 (Sprint 2, proactive coach)

### Open ontwerpvraag

- Bandvisualisatie per contributor: dezelfde sparkline als `useGoalSparkline`, of nieuwe baseline-band style? Voorstel: hergebruik en breid extend met `band={low, high}` prop.

---

## Ticket P1-2 — Cold-start expectation UI

**Score:** 8.6 (quick win)
**Omvang:** XS
**Files vermoedelijk geraakt:** `ReadinessSignal.tsx` (of nieuwe hero), evt. `useReadiness.ts`.

### Acceptatiecriteria

1. Wanneer er <14 dagen aan baseline data zijn voor HRV / sleep, toont de hero readiness een **status-strip** boven of onder de score:
   - "Pulse leert nog je baseline. Nog **X nachten** voor betrouwbare readiness."
   - Subtiele kleur (text-secondary), geen alarm
2. Score blijft zichtbaar (niet verbergen), maar krijgt visuele indicatie "voorlopig" (b.v. dashed ring i.p.v. solid, of `*` na het getal).
3. Telling X komt uit een nieuwe selector op `metric_baselines` of een afgeleide in `useReadiness`. Voorstel: `daysOfBaseline: number` toevoegen aan `ReadinessSummary` payload.
4. Strip verdwijnt vanaf 14 dagen.

### Waarom dit eerst

Voorkomt dat de eerste indrukken van een vergrote hero (P1-1) gebaseerd zijn op een baseline van 3 nachten. Zonder dit krijgt P1-1 verkeerde initial trust.

---

## Ticket P1-3 — Tone-of-voice selector voor coach

**Score:** 7.2 (quick win)
**Omvang:** XS
**Files vermoedelijk geraakt:** `src/app/settings/`, `src/lib/ai/prompts/`, `ai_custom_instructions` tabel (al aanwezig).

### Acceptatiecriteria

1. In `/settings` een nieuwe sectie "Coach toon" met radio/select:
   - **Direct** (default): "Je trainingsload is hoog. Vandaag rust."
   - **Vriendelijk**: "Hé Stef, je hebt deze week flink gepushed — neem vandaag rust, je hebt het verdiend."
   - **Wetenschappelijk**: "Acute:chronic ratio is 1.42, boven de 1.3 sweet-spot. Aanbevolen: parasympathische activiteit ≤60% HRmax."
2. Keuze persisteert in `ai_custom_instructions` (bestaand schema, nieuwe key `coach_tone`).
3. Systeem-prompt builder in `src/lib/ai/prompts/` leest deze key en injecteert een tone-instructie blok.
4. Werkt direct in zowel `/chat` (reactive) als — nadat P2-1 bestaat — proactive cards.

### Waarom in deze sprint

Triviale dev, hoge perceived personalization. En het is een prerequisite voor P2 (proactive coach) zodat die meteen in de juiste toon spreekt.

---

## Sprint-volgorde & dependencies

```
P1-2 (cold-start) ──┐
                    ├──→ P1-1 (hero) ──→ Sprint 2
P1-3 (tone)        ─┘
```

P1-2 en P1-3 zijn losstaand en kunnen eerst (XS, geen risico). P1-1 daarna profiteert van P1-2's status-strip.

---

## Definition of done voor de sprint

- [ ] Alle 3 tickets gemerged op `main` (PR per ticket)
- [ ] Manual test op mobiel + desktop
- [ ] Reduced-motion check
- [ ] Stef opent home 's ochtends en kan in <2 sec besluiten "ga ik trainen of niet?"
- [ ] Stef voelt dat de coach-toon klopt met zijn voorkeur

---

## Vervolgens

Na sprint 1 → **Sprint 2 "Proactive coach"** (#2 + #3): cron-driven coach card + daily strain target. Dat is waar Pulse écht uniek wordt — geen concurrent heeft een real-LLM proactive nudge met memory + workload-aware band-aanbeveling.
