# Claude Code Prompt: Pulse Apple Design Overhaul

Plak dit als prompt in Claude Code wanneer je klaar bent om te beginnen.

---

## Prompt

```
Lees eerst het bestand DESIGN-PLAN.md in de root van dit project. Dit bevat het volledige design plan voor een Apple HIG-style redesign van Pulse.

Voer het plan uit in de volgorde beschreven onder "Uitvoeringsvolgorde". Werk stap voor stap — doe één stap, laat me het resultaat zien, en wacht op mijn bevestiging voordat je doorgaat.

Hier zijn de regels:

1. **Verander GEEN functionaliteit.** Dit is een puur visuele refactor. Geen data logic, geen API changes, geen routing changes.

2. **Design tokens eerst.** Begin met globals.css en tailwind.config.ts. Alle kleur-, font- en spacing-waarden uit DESIGN-PLAN.md moeten als CSS variables en Tailwind theme extensions worden opgezet voordat je aan componenten begint.

3. **Maak herbruikbare basis-componenten.** Maak een `src/components/ui/` folder (als die er nog niet is) met:
   - `Button.tsx` — primary (capsule, system-blue), secondary, ghost varianten. Min-height 44px.
   - `Card.tsx` — rounded-2xl, Apple shadows light mode, subtle border dark mode.
   - `GlassPanel.tsx` — backdrop-blur component voor tab bar en modals.
   - `SectionHeader.tsx` — iOS Settings-style section headers (uppercase, footnote size, secondary label color).
   
   Gebruik de exacte CSS waarden uit DESIGN-PLAN.md.

4. **Lucide icons:** zet strokeWidth op 1.5 en size op 22 voor navigation icons, 18 voor inline icons.

5. **Framer Motion:** installeer framer-motion als die er nog niet is. Voeg page transitions en card hover animaties toe volgens de spring configs in DESIGN-PLAN.md.

6. **Charts:** pas Recharts styling aan — Apple system colors, verwijder onnodige gridlines, ronde hoeken op bars, glass-effect tooltips.

7. **Dark mode:** test elke wijziging in zowel light als dark mode. Dark mode gebruikt subtiele borders (border-white/[0.06]) in plaats van schaduwen.

8. **Geen glass-effect op gewone cards.** Alleen op: tab bar, modals, chat overlay. Apple's eigen regel: gebruik het spaarzaam.

9. Na elke stap: geef een korte samenvatting van wat je hebt gedaan en welke bestanden je hebt gewijzigd. Wacht dan op mijn "ga door" of feedback.

Begin met stap 1: Design tokens in globals.css en tailwind.config.ts.
```

---

## Tips voor gebruik

- Als je al een `globals.css` hebt met bestaande tokens, vraag Claude Code om de bestaande te *vervangen*, niet ernaast te zetten.
- Als je shadcn/ui components gebruikt, moeten de Apple tokens ook gemapped worden naar shadcn's verwachte variabelen (`--background`, `--foreground`, `--primary`, etc.). Vraag Claude Code hier expliciet om als dat relevant is.
- Je kunt de Smithery Apple HIG skill ook installeren als Claude Code skill voor extra context:
  ```
  npx @smithery/cli@latest skill add axiaoge2/apple-hig-designer
  ```
  Dit geeft Claude Code extra kennis over HIG patterns, maar is optioneel — DESIGN-PLAN.md bevat al alle tokens en specs.
