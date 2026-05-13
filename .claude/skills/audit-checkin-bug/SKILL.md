---
name: audit-checkin-bug
description: Root cause analyse van de weekly check-in wizard die de verkeerde week plant. Onderzoekt timezone-handling, week-start berekening, Google Calendar integratie, en DST-edge cases.
---

# Check-in Week-planning Bug RCA

Stef heeft expliciet aangegeven: "ik zag dat nu de week niet goed is gepland voor de week erop tijdens de check-in wizard, maar waar gaat dat dan mis? dat mag echt niet"

Dit is een bug-hunt. Volg deze stappen serieel.

## Stap 1: Reproduceer mentaal
De flow:
1. User opent `/check-in` (meestal op zondag/maandag)
2. POST `/api/check-in/analyze` — analyseert "afgelopen week"
3. POST `/api/check-in/plan` — genereert "komende week"
4. GET `/api/check-in/plan/conflicts` — checkt Google Calendar
5. POST `/api/check-in/confirm` — schrijft sessies naar Google Calendar

Welke "week" wordt gepland? Dat hangt af van:
- Wanneer de user de wizard opent (zondag = makkelijk; donderdag = lastig)
- Welke timezone (gebruiker is in Europe/Amsterdam, cron in UTC)
- Hoe "week-start" wordt gedefinieerd (ISO 8601: maandag; US: zondag)
- Of DST een rol speelt (laatste zondag in maart / oktober)

## Stap 2: Lees de relevante code
```bash
# Locatie van check-in logic
find src/app/api/check-in -type f
find src/lib -name "*check*" -o -name "*week*" -o -name "*date*"
```

Verwachte verdachten:
- `src/lib/dates/week.ts` of vergelijkbaar — week-start berekening
- `src/app/api/check-in/plan/route.ts` — de planner
- `src/lib/google/calendar.ts` — calendar write logic
- Cron config in `vercel.json`

## Stap 3: Common bug-patronen
Check expliciet op:

### 3.1 `new Date()` in server vs client
```typescript
// FOUT: server runt in UTC, client in user timezone
const today = new Date(); // 23:30 vrijdag Amsterdam = 22:30 vrijdag UTC = nog geen weekend in UTC
const dayOfWeek = today.getDay(); // gebruikt server timezone

// GOED:
import { TZDate } from "@date-fns/tz";
const today = new TZDate(new Date(), "Europe/Amsterdam");
```

### 3.2 `getDay()` vs ISO week
```typescript
// JavaScript: zondag = 0, maandag = 1
// ISO 8601: maandag = 1, zondag = 7
// Bij week-start berekening: als je `dayOfWeek - 1` doet voor maandag-offset
// en het is zondag (0), krijg je -1 dag van vandaag = zaterdag → fout
```

### 3.3 Off-by-one bij "week erna"
```typescript
// FOUT: vandaag is zondag, "next week" = vandaag + 7 dagen = volgende zondag
// Maar je wilt "next ISO week" = aanstaande maandag

// GOED:
const nextMonday = addDays(startOfWeek(today, { weekStartsOn: 1 }), 7);
```

### 3.4 DST transities
- Laatste zondag maart 2026: 29 maart (CET → CEST)
- Laatste zondag oktober 2026: 25 oktober (CEST → CET)
- `addDays(date, 7)` werkt correct want het is UTC-add
- MAAR: `setHours(6, 30)` na een DST-transitie kan 1 uur off zijn

### 3.5 Google Calendar timezone
```typescript
// Goed:
await calendar.events.insert({
  calendarId: 'primary',
  requestBody: {
    start: { dateTime: '2026-04-13T06:30:00', timeZone: 'Europe/Amsterdam' },
    end: { dateTime: '2026-04-13T07:30:00', timeZone: 'Europe/Amsterdam' },
  }
});

// Fout (UTC):
await calendar.events.insert({
  requestBody: {
    start: { dateTime: '2026-04-13T06:30:00Z' }, // = 08:30 in Amsterdam in zomertijd
  }
});
```

### 3.6 Welke week is "afgelopen"?
Als user op zondagavond incheckt:
- Strict: "afgelopen week" = ma t/m za die net voorbij is (incl. vandaag)
- Lakser: "afgelopen week" = vorige ma t/m zo (vandaag uitgesloten)
- Pulse-context: zondag is rustdag, dus vandaag heeft geen data — vorige ma t/m za = correct?

Voor "komende week":
- Strict: aanstaande maandag t/m zondag erna
- Lakser: vanaf morgen t/m 7 dagen later

## Stap 4: Diagnose
Voor elke gevonden afwijking van best-practice, log:
- Bestand:regel
- Wat er fout staat
- Wat het symptoom zou zijn (bijv. "wizard plant verkeerde week als user op zondag incheckt")
- Concrete fix (code snippet)

## Stap 5: Schrijf een failing test
Maak `tests/check-in-week-calc.test.ts` met edge cases:
- User incheckt op zondag 23:30 Amsterdam tijd
- User incheckt op maandag 00:30 Amsterdam tijd
- User incheckt op de DST-transitie (29 maart of 25 oktober)
- User incheckt op donderdag (irreguliere case)

## Output
`.claude/audit-output/08-checkin-bug-rca.md`:
1. Root cause(s) — kort en concreet
2. Code-locaties met regelnummers
3. Symptomen die hieruit volgen
4. Fix met code-snippet (klaar voor PR)
5. Failing test om regressie te voorkomen
6. PR-bundle in `.claude/audit-output/prs/001-fix-checkin-week-calculation/`

Stop NIET tot je een concrete root cause hebt geïdentificeerd of definitief kunt zeggen "dit lijkt correct, het issue zit elders — vraag Stef om reproductie-stappen".
