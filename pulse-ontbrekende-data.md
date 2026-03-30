# Ontbrekende data voor Pulse — toe te voegen via chat of seed script

Dit document bevat alle historische data die wel in het PT-project aanwezig is maar nog niet in de Pulse-database staat. Alles hieronder kun je inladen via de chat of door de seed script uit te breiden.

---

## 1. Lichaamscompositie (InBody scans)

### InBody meting #1 — 5 maart 2026
| Meting | Waarde |
|---|---|
| Gewicht | 77.4 kg |
| Spiermassa | 34.7 kg |
| Vetmassa | 15.7 kg |
| Vetpercentage | 20.2% |
| BMI | 23.4 |
| Visceraal vet | Level 6 |

### InBody meting #2 — eind maart 2026 (week 4 afronding)
| Meting | Waarde | vs meting #1 |
|---|---|---|
| Spiermassa | 36.1 kg | +1.4 kg |
| Vetmassa | 15.4 kg | -0.3 kg |
| Vetpercentage | ~19% | -1.2% |

**Actie:** Toevoegen als `profiles.weight_kg` updates + aparte notitie in goals of als custom personal records.

---

## 2. Historische gymworkouts (weeks 1-4)

De seed script seed alleen PRs en schema-metadata, niet de daadwerkelijke workout-sessies. Hieronder alle gelogde sessies uit het PT project.

### Week 1 — Workout A (dinsdag 3 maart 2026)
| Oefening | Set 1 | Set 2 | Set 3 |
|---|---|---|---|
| Goblet Squat | 10 kg x 10 | 12 kg x 10 | 12 kg x 10 |
| DB Bench Press | 10 kg x 10 | 12.5 kg x 10 | 12.5 kg x 10 |
| Leg Press | 70 kg x 12 | 70 kg x 12 | 80 kg x 12 |
| Seated Cable Row (V) | 25 kg x 10 | 30 kg x 10 | 30 kg x 10 |
| Plank | 1:13 | 1:01 | 1:01 |

### Week 1 — Workout C (donderdag 5 maart 2026)
| Oefening | Set 1 | Set 2 | Set 3 |
|---|---|---|---|
| Bulgarian Split Squat | BW x 8 | BW x 8 | BW x 8 |
| Single Arm Cable Row | 9 kg x 12 | 9 kg x 12 | 11 kg x 12 |
| Push-ups | 9 | 7 | 9 |
| Kettlebell Swing | 12 kg x 15 | 12 kg x 15 | 12 kg x 15 |
| Face Pull | 3.5 kg x 15 | 3.5 kg x 15 | 3.5 kg x 15 |
| Farmer's Walk | 25 kg x 40m | 25 kg x 40m | 25 kg x 41m |

### Week 1 — Workout B (vrijdag 6 maart 2026)
| Oefening | Set 1 | Set 2 | Set 3 |
|---|---|---|---|
| Romanian Deadlift (DB) | 10 kg x 10 | 10 kg x 10 | 10 kg x 10 |
| Lat Pulldown | 25 kg x 12 | 30 kg x 10 | 30 kg x 10 |
| Leg Curl | 10 kg x 12 | 12.5 kg x 12 | 12.5 kg x 12 |
| Incline DB Press | 10 kg x 10 | 10 kg x 12 | 10 kg x 12 |
| Pallof Press | 9 kg x 12 | 9 kg x 12 | 9 kg x 12 |

### Week 2 — Workout A (maandag 9 maart 2026)
| Oefening | Set 1 | Set 2 | Set 3 |
|---|---|---|---|
| Goblet Squat | 10 kg x 10 | 10 kg x 10 | 12.5 kg x 10 |
| DB Bench Press | 12.5 kg x 10 | 12.5 kg x 10 | 12.5 kg x 10 |
| Leg Press | 70 kg x 12 | 70 kg x 12 | 70 kg x 12 |
| Seated Cable Row (V) | 30 kg x 12 | 30 kg x 10 | 30 kg x 10 |
| Plank | 1:20 | 1:05 | 1:06 |

### Week 2 — Workout B (dinsdag 10 maart 2026)
| Oefening | Set 1 | Set 2 | Set 3 |
|---|---|---|---|
| Romanian Deadlift (DB) | 12.5 kg x 10 | 12.5 kg x 10 | 12.5 kg x 10 |
| Lat Pulldown | 30 kg x 12 | 35 kg x 10 | 35 kg x 10 |
| Leg Curl | 15 kg x 12 | 15 kg x 12 | 17.5 kg x 12 |
| Incline DB Press | 10 kg x 10 | 12 kg x 12 | 12 kg x 12 |
| Pallof Press | 9 kg x 12 | 9 kg x 12 | 9 kg x 12 |

### Week 2 — Workout C (donderdag 12 maart 2026)
| Oefening | Set 1 | Set 2 | Set 3 |
|---|---|---|---|
| Bulgarian Split Squat | 8 kg x 10 | 8 kg x 10 | 8 kg x 10 |
| Single Arm Cable Row | 9 kg x 12 | 9 kg x 12 | 11 kg x 12 |
| Push-ups | 13 | 10 | 10 |
| Kettlebell Swing | 12 kg x 15 | 12 kg x 15 | 12 kg x 15 |
| Face Pull | 3.5 kg x 15 | 6.5 kg x 15 | 8.5 kg x 15 |
| Farmer's Walk | 25 kg x 40m | 25 kg x 40m | 25 kg x 40m |

### Week 3 — gedeeltelijk (16–22 maart 2026)
- Maandag 16 mrt: Workout A ✅ + Padel 16:30
- Dinsdag 17 mrt: Workout C 06:30 (details niet gelogd in PT project)
- Donderdag 19 mrt: Workout B 06:30 + Padel 21:00
- Vrijdag 20 mrt: 8 km long run ✅
- Zaterdag 21 mrt: Padel 10:30

### Week 4 — eindrresultaten (uit terugblik week 5-8 plan)
Exacte sets niet gelogd, wel de best prestaties:
| Oefening | Beste prestatie week 4 |
|---|---|
| Push-ups (set 1) | 20 reps |
| Plank (set 1) | 1:35 |
| Goblet Squat | 16 kg |
| DB Bench Press | 16 kg |
| Leg Press | 90 kg |
| Lat Pulldown | 40 kg |
| BSS | 10 kg x 10 |
| KB Swing | 16 kg |

**Actie:** Aanmaken als `workouts` + `workout_exercises` + `workout_sets` entries, of accepteren dat Hevy sync dit retroactief aanvult zodra die gekoppeld is.

---

## 3. Historische runs (weeks 1-3)

| Datum | Beschrijving | Afstand | Gem. pace | HR | Notitie |
|---|---|---|---|---|---|
| ~ma 9 mrt | Long Run (uitgesteld van week 1) | 8 km | ~5:40/km | — | |
| wo 4 mrt (ca.) | Interval run week 1 | 6.71 km | — | — | |
| wo 12 mrt | 1km Repeats interval | 5.51 km | 6:11/km | 168 bpm | |
| vr 14 mrt | Long run (was 8 km, gedaan als 6 km) | ~6 km | 5:57/km | 159 bpm | |
| vr 20 mrt | Long run week 3 | 8 km | — | — | 200m Repeats interval geskipt |

**Actie:** Toevoegen als `runs` entries. Source: `manual`.

---

## 4. Historische padel sessies (weeks 1-3)

| Datum | Duur | Calorieën | Notitie |
|---|---|---|---|
| Week 1 (ca. ma 2 mrt) | 69 min | 783 kcal | |
| Week 2 (ca. ma 9 mrt) | 81 min | 1036 kcal | |
| Week 3 maandag (16 mrt) | ~75 min | — | ook do avond + za ochtend |
| Week 3 donderdag (19 mrt avond) | ~75 min | — | |
| Week 3 zaterdag (21 mrt) | ~75 min | — | |

**Actie:** Toevoegen als `padel_sessions` entries. Source: `apple_health` of `manual`.

---

## 5. Dagelijkse stappen (wekelijkse gemiddelden)

| Week | Gem. stappen/dag |
|---|---|
| Week 1 (2–8 mrt) | 10.470 |
| Week 2 (9–15 mrt) | 11.645 |
| Week 3 (16–22 mrt) | niet geregistreerd |

**Actie:** Backfillen als `daily_activity` entries of accepteren als ontbrekend. Minder kritiek voor de AI-context.

---

## 6. Runna hardloopplan — volledig schema

Het 8-weekse Runna plan dat je nu volgt (lopend t/m race 11 april):

| Week | Datum | Interval/Tempo | Long Run | Status |
|---|---|---|---|---|
| Week 1 | 16 feb | 5km — 400m Repeats (di) | 6km (vr) | ✅ Gestart |
| Week 2 | 23 feb | 5.2km — Over & Unders 400m (di) | 7km (vr) | ✅ Padeltoernooi, run geskipt |
| Week 3 | 2 mrt | 5.9km — Short Rep, Drop Sets (di) | 8km (vr) | ✅ Run wo 6.71km gedaan |
| Week 4 | 9 mrt | 5km — 1km Repeats (di) | 6km (vr) | ✅ Interval + 2x long run |
| Week 5 | 16 mrt | 6.2km — 200m Repeats (di) | 8km (vr) | ✅ Interval geskipt, long run vr 8km |
| Week 6 | 23 mrt | 7km — Pyramid Intervals (di) | 10km (vr) | In schema |
| Week 7 | 30 mrt | 7.1km — Broken 600s (di) | 8km (vr) | In schema |
| Week 8 | 6 apr | 6km — Race Pace Practice (di) | **8km Race za 11 apr** | Finaal |

**Actie:** Dit is statische kennis — toevoegen aan system prompt of als document in de kennisbase. Geen DB-tabel nodig, maar de race op 11 april verdient een `goal` entry als dat er nog niet is.

---

## 7. Wat wél al goed staat in Pulse

Ter referentie: dit zit correct in `seed-stef-data.ts` en/of de system prompt.

| Data | Status |
|---|---|
| Baseline PRs (23 feb 2026) | ✅ Geseed |
| Week 4 end PRs (23 mrt 2026) | ✅ Geseed |
| Actief schema (week 5-8 Upper/Lower) | ✅ Geseed |
| Block summary week 1-4 | ✅ Geseed |
| Schouder blessure | ✅ Geseed |
| Knieen blessure | ✅ Geseed |
| Onderrug klacht | ✅ Geseed |
| Doelen (pull-up, bench 20kg, plank 2:00, 10K race, 140g eiwit) | ✅ Geseed |
| Motivatiepatroon + geleerde lessen | ✅ In system prompt |
| Blessure-restricties | ✅ In system prompt + DB |
| Voedingsdoelen (140g eiwit, 2100 kcal) | ✅ In system prompt |
| Wekelijkse structuur (gym ma-do, run vr, padel ma avond) | ✅ In system prompt |

---

## 8. Prioritering: wat moet als eerste erin?

**Hoge prioriteit (AI-context wordt er beter van):**
1. Hevy koppelen → sync haalt automatisch alle workouts op incl. week 1-4
2. Apple Health koppelen → sync haalt runs + padel + stappen op
3. InBody meting #1 en #2 toevoegen als body composition records

**Middel prioriteit:**
4. Runna plan toevoegen als goal/schema notitie
5. Historische runs handmatig invullen als Runna/Apple Health niet retroactief synct

**Lage prioriteit (systeem werkt ook zonder):**
6. Stappen-historie backfillen
7. Padel-sessies handmatig als Apple Health geen retroactieve sync heeft

---

## 9. Hoe toevoegen?

### Via chat (snelst)
Typ in Pulse chat:
> "Voeg InBody meting toe: datum 5 maart 2026, gewicht 77.4kg, spiermassa 34.7kg, vetmassa 15.7kg, vetpercentage 20.2%"

Of voor een run:
> "Ik heb op 12 maart een interval run gedaan: 5.51 km in ~34 min, gem. pace 6:11/km, HR 168 bpm"

### Via seed script uitbreiding
Voeg een `seedWorkoutHistory()` functie toe aan `scripts/seed-stef-data.ts` die de workout-data uit sectie 2 hierboven inserts als echte `workouts` + `workout_exercises` + `workout_sets` records.

### Via Hevy sync (aanbevolen)
Zodra `hevy_api_key` is ingesteld in Instellingen → automatische sync haalt alles op inclusief volledige sets/reps. Dit is de schoonste route.
