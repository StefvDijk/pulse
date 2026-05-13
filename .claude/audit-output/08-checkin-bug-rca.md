# Fase 8 — Root Cause Analysis: Weekly Check-in plant verkeerde week

**Symptoom (Stef):** "ik zag dat nu de week niet goed is gepland voor de week erop tijdens de check-in wizard, maar waar gaat dat dan mis? dat mag echt niet"

**Severity:** P0 — kernfunctie van de app is kapot voor 100% van de Sunday-evening flow.

---

## TL;DR

De wizard plant de **review-week** in plaats van de week erná. `CheckInFlow.tsx` geeft `data.week.weekStart` / `data.week.weekEnd` (= de week die je net reviewt, dus de net-afgelopen of bijna-afgelopen ISO-week) één-op-één door aan `<WeekPlanCard>`. Daardoor:

1. De `/api/check-in/plan` API krijgt de reeds verstreken ISO-week.
2. Claude genereert sessies met datums in het verleden (of in de huidige week die al half om is).
3. `<WeekPlanCard>` toont de gebruiker die past-dates als "volgende week".
4. Bij `confirm` worden `scheduled_overrides` geschreven op de verkeerde data (review-week) en wijken Google Calendar events af van wat de UI suggereert.

Er is **geen plek** in de code waar `weekStart + 7` wordt uitgerekend voor het planningsdeel. De hele wizard rekent met één enkele week-range.

---

## 1. Root cause(s)

### 1.1 PRIMARY — week wordt nooit "+1" gezet voor de planner

**Bestand:** `src/components/check-in/CheckInFlow.tsx:266-272`

```tsx
{step === 3 && (
  <WeekPlanCard
    reviewData={data}
    onNext={handlePlanComplete}
    weekStart={data.week.weekStart}   // ← review-week
    weekEnd={data.week.weekEnd}       // ← review-week
  />
)}
```

`data.week.weekStart` komt uit `/api/check-in/review` (route.ts:273):

```ts
const weekStart = weekStartParam ?? getWeekStart(new Date())
const weekEnd = getWeekEnd(weekStart)
```

`getWeekStart(new Date())` retourneert de **maandag van de huidige ISO-week**. Dat is de week die je reviewt (correct), maar diezelfde range belandt vervolgens in `<WeekPlanCard>` → `useWeekPlan.generate(weekStart, weekEnd)` → `POST /api/check-in/plan` (`src/hooks/useWeekPlan.ts:34-42`).

De planner mist dus structureel een `+7 dagen` offset.

### 1.2 SECONDARY — `getWeekStart` werkt op UTC voor een Europe/Amsterdam-gebruiker

**Bestanden:**
- `src/app/api/check-in/review/route.ts:77-84`
- `src/app/api/check-in/status/route.ts:9-15`

```ts
function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getUTCDay()                       // ← UTC day-of-week
  const diff = (day === 0 ? 6 : day - 1)
  d.setUTCDate(d.getUTCDate() - diff)
  return d.toISOString().slice(0, 10)
}
```

Voor een Amsterdam-user:
- Zomertijd (CEST, UTC+2): elke dag tussen 00:00–02:00 lokaal staat in UTC nog op de "vorige" dag.
- Wintertijd (CET, UTC+1): elke dag tussen 00:00–01:00 lokaal staat in UTC nog op de "vorige" dag.

**Concrete edge case:** Stef opent de wizard maandag 19 oktober 2026 om 01:30 CEST (laatste maandag voordat DST eindigt). UTC = zondag 18 oktober 23:30. `getUTCDay() === 0` (zondag). `diff = 6`. Resultaat: `weekStart = 2026-10-12` — de week **daarvoor**. Combineer met bug 1.1 en de gebruiker plant nu een ISO-week die 14 dagen achterloopt.

### 1.3 TERTIARY — `updateScheduledOverrides` ijkt op de review-week

**Bestand:** `src/app/api/check-in/confirm/route.ts:243-301`

```ts
async function updateScheduledOverrides(
  admin, userId, sessions, weekStart  // ← input.week_start = review-week
) { ... }
```

```ts
// route.ts:148
updateScheduledOverrides(admin, user.id, input.planned_sessions, input.week_start)
```

Als bug 1.1 gefixed wordt zónder dit pad mee te nemen, gebeurt het tegenovergestelde: de AI-plan datums zitten op de juiste week, maar `WEEK_DAYS.forEach((dayName, index)...)` itereert vanaf de review-week. Geen enkele `plannedByDate.get(dateStr)` match → alle scheduled overrides worden `null` gezet → de gebruiker krijgt 7 dagen rust ingepland in zijn schema. Slechter dan de huidige bug.

### 1.4 QUATERNARY — DST-veiligheid in Google Calendar writes

**Bestand:** `src/lib/google/calendar.ts:55, 108, 109`

Goede patroon: `{ dateTime: '2026-04-13T06:30:00', timeZone: 'Europe/Amsterdam' }`. Geen `Z`-suffix, geen handmatige offset. Dit is robuust over DST-grenzen.

✅ Geen actie nodig hier, maar opnemen als regressie-test.

---

## 2. Code-locaties (samenvatting)

| Bestand | Regel | Probleem |
|---|---|---|
| `src/components/check-in/CheckInFlow.tsx` | 270-271 | Geeft review-week door als plan-week |
| `src/app/api/check-in/review/route.ts` | 77-84, 273 | UTC-based week-start; review-week wordt impliciet als plan-week hergebruikt |
| `src/app/api/check-in/status/route.ts` | 9-15 | Duplicated `getWeekStart` met zelfde UTC-bug |
| `src/app/api/check-in/plan/route.ts` | 151, 169-173 | Accepteert weekStart/weekEnd zonder validatie dat het in de toekomst ligt |
| `src/app/api/check-in/confirm/route.ts` | 148, 247, 270-274 | `updateScheduledOverrides` neemt review-week i.p.v. plan-week |
| `src/components/check-in/ConfirmationCard.tsx` | 76-77 | Stuurt alleen `week_start`/`week_end` (review). `next_week_start` ontbreekt. |

---

## 3. Symptomen die hieruit volgen

1. **Plan-datums in het verleden** (primair). Voor een check-in op zondagavond: alle voorgestelde dagen liggen Mon-Sun van de net-voorbije ISO-week. UI lijkt "klopt qua dag", maar Google Calendar krijgt past events.
2. **Plan-datums in deze week, half voorbij** als Stef niet op zondag/maandag maar bv. donderdag incheckt: maandag/dinsdag/woensdag zijn al voorbij en kunnen niet meer worden uitgevoerd.
3. **`scheduled_overrides` op verkeerde data** (tertiair). Daardoor laat `/schema` zien dat maandag–zondag van de review-week "gewijzigd" zijn — niet de week erná.
4. **Conflict-check tegen verkeerde calendar-events**. `listEvents(user.id, weekStart, weekEnd)` haalt calendar items van de review-week → conflicten gerapporteerd op afgesproken trainingen die al zijn gebeurd; geen check op de week die echt gepland wordt.
5. **DST-transitie**: in maart 2026 (zaterdag 28 → zondag 29) en oktober 2026 (zaterdag 24 → zondag 25) kan de wizard rond middernacht een hele week verspringen.
6. **Weekly review duplicatie risico**: als de review-week niet uniek per upsert match — kan onder DST-edge een dubbele rij ontstaan vóór de unique-constraint hit.

---

## 4. Concrete fix

### 4.1 Centrale date-utility (nieuwe file)

`src/lib/dates/week.ts`:

```ts
import { TZDate, tz } from '@date-fns/tz'
import { startOfWeek, endOfWeek, addDays, format, getISOWeek, getISOWeekYear } from 'date-fns'

const TIMEZONE = 'Europe/Amsterdam'

/** Returns "YYYY-MM-DD" of the Monday for the ISO-week of `now` in Europe/Amsterdam */
export function currentWeekStart(now: Date = new Date()): string {
  const local = new TZDate(now, TIMEZONE)
  const monday = startOfWeek(local, { weekStartsOn: 1 })
  return format(monday, 'yyyy-MM-dd')
}

export function weekEnd(weekStart: string): string {
  const start = new TZDate(`${weekStart}T00:00:00`, TIMEZONE)
  return format(endOfWeek(start, { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

/** weekStart + 7 days, returned as "YYYY-MM-DD" */
export function nextWeekStart(weekStart: string): string {
  const start = new TZDate(`${weekStart}T00:00:00`, TIMEZONE)
  return format(addDays(start, 7), 'yyyy-MM-dd')
}

export function isoWeekNumber(weekStart: string): { weekNumber: number; year: number } {
  const start = new TZDate(`${weekStart}T00:00:00`, TIMEZONE)
  return { weekNumber: getISOWeek(start), year: getISOWeekYear(start) }
}
```

Vervang álle inline `getWeekStart`/`getWeekEnd`/`getISOWeekNumber` in `review/route.ts`, `status/route.ts`, `history/route.ts` met deze helpers.

### 4.2 Pass nextWeek aan `<WeekPlanCard>`

`src/components/check-in/CheckInFlow.tsx`:

```diff
+import { nextWeekStart as nextWeekStartOf, weekEnd as weekEndOf } from '@/lib/dates/week'
...
+  const planWeekStart = nextWeekStartOf(data.week.weekStart)
+  const planWeekEnd = weekEndOf(planWeekStart)
...
-          <WeekPlanCard
-            reviewData={data}
-            onNext={handlePlanComplete}
-            weekStart={data.week.weekStart}
-            weekEnd={data.week.weekEnd}
-          />
+          <WeekPlanCard
+            reviewData={data}
+            onNext={handlePlanComplete}
+            weekStart={planWeekStart}
+            weekEnd={planWeekEnd}
+          />
```

### 4.3 ConfirmationCard stuurt BEIDE weken

`src/components/check-in/ConfirmationCard.tsx`:

```diff
       const body = {
         week_start: reviewData.week.weekStart,
         week_end: reviewData.week.weekEnd,
+        plan_week_start: planWeekStart,   // ← geprop’t vanuit CheckInFlow
         week_number: reviewData.week.weekNumber,
         ...
```

### 4.4 `/api/check-in/confirm` accepteert `plan_week_start`

`src/app/api/check-in/confirm/route.ts`:

```diff
 const Body = z.object({
   week_start: z.string().date(),
   week_end: z.string().date(),
+  plan_week_start: z.string().date(),
   ...
 })
...
-updateScheduledOverrides(admin, user.id, input.planned_sessions, input.week_start)
+updateScheduledOverrides(admin, user.id, input.planned_sessions, input.plan_week_start)
```

### 4.5 `/api/check-in/plan` valideert dat weekStart in de toekomst ligt

```ts
const today = currentWeekStart()
if (parsed.data.weekStart <= today) {
  return NextResponse.json(
    { error: 'plan-week mag niet de huidige of een verstreken ISO-week zijn', code: 'BAD_WEEK' },
    { status: 400 },
  )
}
```

Beschermt tegen toekomstige regressies.

---

## 5. Failing test (regressie-preventie)

`tests/check-in-week-calc.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { currentWeekStart, nextWeekStart, weekEnd, isoWeekNumber } from '@/lib/dates/week'

describe('currentWeekStart (Europe/Amsterdam)', () => {
  it('zondag 21:00 → Monday-of-current-ISO-week', () => {
    const sundayEvening = new Date('2026-05-10T19:00:00Z') // 21:00 Amsterdam CEST
    expect(currentWeekStart(sundayEvening)).toBe('2026-05-04')
  })

  it('maandag 01:30 CEST → Monday-of-NEW-ISO-week (niet de oude)', () => {
    const earlyMonday = new Date('2026-05-10T23:30:00Z') // 01:30 ma 11 mei CEST
    expect(currentWeekStart(earlyMonday)).toBe('2026-05-11')
  })

  it('DST start zondag 29 maart 2026 03:00 → Monday 23 maart', () => {
    const dstSwitch = new Date('2026-03-29T03:30:00Z')
    expect(currentWeekStart(dstSwitch)).toBe('2026-03-23')
  })

  it('DST eind zondag 25 oktober 2026 02:30 → Monday 19 oktober', () => {
    const dstSwitch = new Date('2026-10-25T01:30:00Z')
    expect(currentWeekStart(dstSwitch)).toBe('2026-10-19')
  })

  it('donderdag → Maandag van diezelfde week', () => {
    const thursday = new Date('2026-05-14T12:00:00Z')
    expect(currentWeekStart(thursday)).toBe('2026-05-11')
  })
})

describe('nextWeekStart', () => {
  it('voegt 7 dagen toe over DST start heen', () => {
    expect(nextWeekStart('2026-03-23')).toBe('2026-03-30')
  })

  it('voegt 7 dagen toe over DST eind heen', () => {
    expect(nextWeekStart('2026-10-19')).toBe('2026-10-26')
  })
})

describe('isoWeekNumber', () => {
  it('week 1 hoort bij de eerste donderdag van het jaar', () => {
    expect(isoWeekNumber('2026-12-28')).toEqual({ weekNumber: 53, year: 2026 })
    expect(isoWeekNumber('2027-01-04')).toEqual({ weekNumber: 1, year: 2027 })
  })
})
```

Integratie-test in `tests/check-in-flow.test.ts`:

```ts
it('wizard plant volgende week, niet de huidige', async () => {
  // Mock useCheckInReview met week 19 (review)
  // Mock /api/check-in/plan om weekStart te capturen
  // Assert: capturedWeekStart === currentWeekStart + 7 days
})
```

---

## 6. PR-bundle

Zie `.claude/audit-output/prs/001-fix-checkin-week-calculation.diff` voor het volledige patch-bestand (CheckInFlow, ConfirmationCard, confirm/route, plan/route, nieuwe `src/lib/dates/week.ts`, nieuwe tests).

---

## 7. Open vragen voor Stef

1. **Semantiek "afgelopen week"**: als je zondag om 22:00 incheckt — review je de week ma–zo van die zondag (inclusief vandaag), of de ma–zo van een week geleden? Huidige code: huidige ISO-week, inclusief vandaag. Mijn aanname: dat is correct, maar bevestig dit.
2. **Conflict-check semantiek**: bij planning voor week N+1 moet `listEvents` ook events van week N+1 ophalen. Heb je een Google Calendar UI bug gezien waar conflicten van de verkeerde week werden gemeld? (Zou een aanvullende bevestiging zijn van de root cause.)
3. **Wat te doen als de gebruiker check-in mist en 2 weken later doet?** Plan voor "next week" of voor "next ISO week"? Dit is een product-vraag, niet code.
4. **Vakantieweken**: als de planner een week target waarin Stef op vakantie is (zoals 13-19 april), moet de AI dit weten? Suggestie: een `away_until` in `user_settings` of in coaching memory.

---

## 8. Direct uitvoerbare acties

1. Maak `src/lib/dates/week.ts` (helper met TZDate + date-fns).
2. Vervang inline week-helpers in `review/route.ts`, `status/route.ts`, `history/route.ts`, `confirm/route.ts`.
3. Pass `nextWeekStart` aan `<WeekPlanCard>` in `CheckInFlow.tsx`; voeg `plan_week_start` toe aan `/confirm` body.
4. Voeg validatie toe in `/api/check-in/plan`: weiger weekStart ≤ huidige ISO-week.
5. Merge `tests/check-in-week-calc.test.ts` met de 7 testcases hierboven. CI moet faalend zijn vóór de fix.
