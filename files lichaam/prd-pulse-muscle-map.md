# PRD: Pulse Muscle Map

## Samenvatting

Interactieve spierkaart die visueel toont welke spiergroepen de afgelopen 7 dagen zijn getraind, op basis van workout data uit de Hevy API. Geïnspireerd op de "Last 7 days body graph" in Hevy (Statistics > Body Graph).

---

## Doel

De gebruiker ziet in één oogopslag welke spiergroepen actief zijn getraind en welke onderbelicht zijn. Spiergroepen kleuren op van grijs (niet getraind) naar diepblauw (zwaar getraind) op basis van het aantal sets in de afgelopen 7 dagen.

---

## Visueel voorbeeld

Twee anatomische figuren naast elkaar: voorkant (VOOR) en achterkant (ACHTER). Boven de figuren een dagselector (Ma t/m Zo) waarmee de gebruiker trainingsdagen aan/uit kan zetten. Onder de figuren een "Volume per spiergroep" staafdiagram.

Referentie: Hevy app > Profile > Statistics > "Last 7 days body graph".

---

## Functionele eisen

### F1: Anatomische SVG body map

- Twee views naast elkaar: voorkant en achterkant
- SVG paths uit `react-native-body-highlighter` v3 (MIT license, npm package)
- Source files: `dist/assets/bodyFront.js` en `dist/assets/bodyBack.js`
- Body outline paths uit: `dist/components/SvgMaleWrapper.js` (de `<Path>` in de front/back conditionals)
- ViewBox: front = `"0 0 724 1448"`, back = `"724 0 724 1448"`
- Elke spiergroep heeft `left` en `right` path arrays die als aparte `<path>` elementen worden gerenderd

### F2: Spiergroep-naar-kleur mapping

Spiergroepen kleuren op basis van het aantal "hits" (sets die die spiergroep raken) in de geselecteerde periode:

| Hits | Kleur (rgba) |
|------|-------------|
| 0 | `rgba(50,60,80,0.25)` — inactief grijs |
| 1-2 | `rgba(40,130,220,0.30)` — lichtblauw |
| 3-4 | `rgba(35,135,240,0.45)` |
| 5-6 | `rgba(30,140,250,0.58)` |
| 7-8 | `rgba(25,130,255,0.72)` |
| 9+ | `rgba(20,120,255,0.88)` — diepblauw |

De schaal is relatief: de spiergroep met de meeste hits = intensiefste kleur.

Decoratieve onderdelen (hoofd, haar, handen, voeten, enkels, knieën) renderen als `rgba(55,65,85,0.35)` en zijn niet interactief.

### F3: Dagselector

- 7 buttons (Ma–Zo) met dagnummer
- Dagen met workouts hebben een indicator-dot
- Toggle: tappen op een dag voegt die toe of verwijdert die uit de selectie
- Standaard: alle dagen met workouts zijn geselecteerd
- Dagen zonder workouts zijn disabled (opacity 0.3)

### F4: Hover/tap tooltip

- Bij hover (desktop) of tap (mobiel) op een spiergroep verschijnt een label boven de figuren
- Format: `{Spiergroep} — {aantal} hits`
- Tap op mobiel verdwijnt na 1.8 seconden

### F5: Volume staafdiagram

- Onder de body maps
- Per spiergroep: label + horizontale balk + getal
- Gesorteerd op volume (hoogste eerst)
- Balk breedte relatief aan de spiergroep met meeste hits
- Alleen spiergroepen tonen die daadwerkelijk getraind zijn

### F6: Sessie-tags

- Onder het staafdiagram
- Per geselecteerde dag: badge met dagnaam + workout label (bijv. "Di Lower A")

---

## Data-architectuur

### Hevy API endpoints (vereist: Hevy PRO + API key)

**Stap 1: Workouts ophalen**

```
GET https://api.hevyapp.com/v1/workouts?page=1&pageSize=10
Header: api-key: {HEVY_API_KEY}
```

Response bevat per workout:
```json
{
  "id": "...",
  "title": "Upper A",
  "start_time": "2026-04-07T05:30:00Z",
  "end_time": "2026-04-07T06:25:00Z",
  "exercises": [
    {
      "exercise_template_id": "3601968B",
      "sets": [
        {
          "weight_kg": 16,
          "reps": 10,
          "set_type": "normal"
        }
      ]
    }
  ]
}
```

Filter op de laatste 7 dagen client-side. Pagineer totdat `start_time` ouder is dan 7 dagen.

**Stap 2: Exercise templates ophalen (eenmalig, cachen)**

```
GET https://api.hevyapp.com/v1/exercise_templates?page=1&pageSize=100
Header: api-key: {HEVY_API_KEY}
```

Response per template:
```json
{
  "id": "3601968B",
  "title": "Bench Press (Dumbbell)",
  "type": "weight_reps",
  "primary_muscle_group": "chest",
  "secondary_muscle_groups": ["triceps", "shoulders"],
  "equipment": "dumbbell"
}
```

Cache deze lijst lokaal. Verandert vrijwel nooit.

**Stap 3: Volume berekenen**

```
voor elke workout in de afgelopen 7 dagen:
  voor elke exercise in workout.exercises:
    template = templates[exercise.exercise_template_id]
    sets = exercise.sets.filter(s => s.set_type === "normal").length
    volume[template.primary_muscle_group] += sets
    template.secondary_muscle_groups.forEach(m => volume[m] += sets * 0.5)  // optioneel: halve hit voor secondary
```

### SVG slug → Hevy muscle_group mapping

| Hevy muscle_group | SVG slug (front) | SVG slug (back) |
|---|---|---|
| chest | chest | — |
| abs | abs, obliques | — |
| biceps | biceps | — |
| triceps | triceps | triceps |
| forearms | forearm | forearm |
| shoulders | deltoids | deltoids |
| neck | neck | neck |
| traps | trapezius | trapezius |
| quadriceps | quadriceps, adductors | — |
| calves | calves, tibialis | calves |
| lats | — | upper-back |
| lower_back | — | lower-back |
| glutes | — | gluteal |
| hamstrings | — | hamstring, adductors |

Hevy's mogelijke `primary_muscle_group` waarden: `chest`, `upper_back`, `lower_back`, `shoulders`, `biceps`, `triceps`, `forearms`, `abs`, `obliques`, `quadriceps`, `hamstrings`, `glutes`, `calves`, `hip_flexors`, `adductors`, `abductors`, `traps`, `neck`, `full_body`, `cardio`, `other`.

`full_body`, `cardio`, en `other` worden genegeerd in de spierkaart.

---

## Technische eisen

### T1: Framework

- React component (`.jsx` of `.tsx`)
- Geen externe dependencies behalve React
- SVG data inline in het component (geëxtraheerd uit npm package)

### T2: SVG data extractie

Installeer `react-native-body-highlighter` (v3.x) en extraheer:

```bash
npm install react-native-body-highlighter
```

Bestanden:
- `node_modules/react-native-body-highlighter/dist/assets/bodyFront.js` → exporteert `bodyFront` array
- `node_modules/react-native-body-highlighter/dist/assets/bodyBack.js` → exporteert `bodyBack` array
- `node_modules/react-native-body-highlighter/dist/components/SvgMaleWrapper.js` → bevat front en back outline `<Path d="...">`

Elke entry in de arrays heeft:
```typescript
{
  slug: string;          // bijv. "chest", "quadriceps"
  color: string;         // default kleur (niet gebruiken)
  path: {
    left?: string[];     // SVG path d-attributes voor linkerkant
    right?: string[];    // SVG path d-attributes voor rechterkant
  }
}
```

### T3: Responsiveness

- Mobiel-first (max-width 420px container)
- Touch events voor mobiel (onTouchStart/onTouchEnd)
- SVG schaalt automatisch via `width: 100%` + `maxWidth: 170px` per figuur

### T4: Dark theme

- Achtergrond: `#0c0f1a`
- Tekst: `#e2e8f0`
- Accent: `#3b82f6` (blauw)
- Inactieve elementen: `#64748b`
- Fonts: DM Sans (body), Space Mono (labels/data)

### T5: Performance

- Exercise templates eenmalig fetchen en cachen (localStorage of in-memory)
- Workouts fetchen bij page load, max 3-4 API calls (paginatie)
- SVG rendering is puur client-side, geen server rendering nodig

---

## Niet in scope (v1)

- Historische vergelijking (vorige week vs deze week)
- Tap op spiergroep → drill-down naar specifieke oefeningen
- Animatie bij kleurverandering
- Female body variant
- Landscape mode
- Webhook-gebaseerde real-time updates (later toevoegen)

---

## Acceptatiecriteria

1. Twee anatomische figuren (voor/achter) renderen correct op mobiel en desktop
2. Alle spiergroepen van hoofd tot voet zijn zichtbaar (inclusief decoratieve delen)
3. Spiergroepen kleuren op van grijs naar blauw op basis van trainingsvolume
4. Dagselector togglet dagen aan/uit en de figuren updaten direct
5. Hover/tap op een spiergroep toont de naam en het aantal hits
6. Volume staafdiagram toont correcte data gesorteerd op volume
7. Bij 0 geselecteerde dagen zijn alle spiergroepen grijs
8. Hevy API data wordt correct opgehaald en gemapped naar SVG spiergroepen

---

## Referentiecode

Een werkend prototype is beschikbaar als `pulse-muscle-map-v5.jsx` in het Pulse project. Dit prototype gebruikt hardcoded workout data. De volgende stap is het vervangen van de hardcoded `WEEK` data door live Hevy API calls.
