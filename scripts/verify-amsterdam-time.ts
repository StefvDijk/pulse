/**
 * Edge-case smoke-runner voor src/lib/time/amsterdam.ts.
 * Geen formele unit tests (project gebruikt manual testing), maar een set concrete
 * gevallen die je in één run kunt verifiëren. DST-overgangen, middernacht-grenzen,
 * en de UTC-vs-Amsterdam off-by-one rond 00:00–02:00 zitten erin.
 *
 * Run:  pnpm tsx scripts/verify-amsterdam-time.ts
 */

import {
  currentDateContext,
  dayIndexAmsterdam,
  dayKeyAmsterdam,
  formatLongDate,
  formatShortDate,
  formatTime,
  startOfDayUtcIso,
  startOfWeekUtcIso,
  todayAmsterdam,
  weekStartAmsterdam,
} from '../src/lib/time/amsterdam'

interface Case {
  name: string
  input: string
  expect: {
    dayKey?: string
    dayIndex?: number
    weekStart?: string
    time?: string
  }
}

const cases: Case[] = [
  {
    name: 'CEST middag — donderdag 30 april 2026, 15:57 NL',
    input: '2026-04-30T13:57:00Z',
    expect: {
      dayKey: '2026-04-30',
      dayIndex: 4,
      weekStart: '2026-04-27',
      time: '15:57',
    },
  },
  {
    name: 'CEST 23:30 NL — UTC nog dezelfde dag',
    input: '2026-04-30T21:30:00Z',
    expect: { dayKey: '2026-04-30', dayIndex: 4 },
  },
  {
    name: 'CEST 00:30 NL — UTC vorige dag (kritieke off-by-one)',
    input: '2026-04-29T22:30:00Z',
    expect: { dayKey: '2026-04-30', dayIndex: 4 },
  },
  {
    name: 'CET (winter) jaarwisseling — 2027-01-01 00:30 NL = 2026-12-31 23:30 UTC',
    input: '2026-12-31T23:30:00Z',
    expect: { dayKey: '2027-01-01', dayIndex: 5 },
  },
  {
    name: 'DST sprong vooruit — 29 maart 2026 03:30 CEST (na de sprong)',
    input: '2026-03-29T01:30:00Z',
    expect: { dayKey: '2026-03-29', dayIndex: 7 },
  },
  {
    name: 'DST sprong terug — 25 oktober 2026',
    input: '2026-10-25T01:30:00Z',
    expect: { dayKey: '2026-10-25', dayIndex: 7 },
  },
  {
    name: 'Zondagavond 23:30 NL — weekStart = de vorige maandag',
    input: '2026-05-03T21:30:00Z',
    expect: { dayKey: '2026-05-03', dayIndex: 7, weekStart: '2026-04-27' },
  },
  {
    name: 'Maandag 00:30 NL — weekStart = die maandag zelf',
    input: '2026-05-03T22:30:00Z',
    expect: { dayKey: '2026-05-04', dayIndex: 1, weekStart: '2026-05-04' },
  },
]

let failures = 0

console.log('▸ Amsterdam-tijdhelper smoke-test\n')

for (const c of cases) {
  const d = new Date(c.input)
  console.log(`  ${c.name}`)
  console.log(`    input  ${c.input}`)
  if (c.expect.dayKey !== undefined) {
    const got = dayKeyAmsterdam(d)
    const pass = got === c.expect.dayKey
    console.log(
      `    dayKeyAmsterdam     → ${got}    verwacht ${c.expect.dayKey}    ${pass ? '✓' : '✗'}`,
    )
    if (!pass) failures++
  }
  if (c.expect.dayIndex !== undefined) {
    const got = dayIndexAmsterdam(d)
    const pass = got === c.expect.dayIndex
    console.log(
      `    dayIndexAmsterdam   → ${got}             verwacht ${c.expect.dayIndex}             ${pass ? '✓' : '✗'}`,
    )
    if (!pass) failures++
  }
  if (c.expect.weekStart !== undefined) {
    const got = weekStartAmsterdam(d)
    const pass = got === c.expect.weekStart
    console.log(
      `    weekStartAmsterdam  → ${got}    verwacht ${c.expect.weekStart}    ${pass ? '✓' : '✗'}`,
    )
    if (!pass) failures++
  }
  if (c.expect.time !== undefined) {
    const got = formatTime(d)
    const pass = got === c.expect.time
    console.log(
      `    formatTime          → ${got}          verwacht ${c.expect.time}          ${pass ? '✓' : '✗'}`,
    )
    if (!pass) failures++
  }
  console.log('')
}

console.log('▸ Live snapshot (huidige machine-tijd)\n')
const now = new Date()
console.log(`  todayAmsterdam()       = ${todayAmsterdam()}`)
console.log(`  weekStartAmsterdam()   = ${weekStartAmsterdam()}`)
console.log(`  dayIndexAmsterdam()    = ${dayIndexAmsterdam()}`)
console.log(`  formatShortDate(now)   = ${formatShortDate(now)}`)
console.log(`  formatLongDate(now)    = ${formatLongDate(now)}`)
console.log(`  formatTime(now)        = ${formatTime(now)}`)
console.log(`  startOfDayUtcIso(now)  = ${startOfDayUtcIso(now)}`)
console.log(`  startOfWeekUtcIso(now) = ${startOfWeekUtcIso(now)}`)
console.log(`  currentDateContext()   =`, currentDateContext(now))

if (failures > 0) {
  console.log(`\n✗ ${failures} assertion(s) gefaald.`)
  process.exit(1)
}
console.log('\n✓ Alle assertions geslaagd.')
