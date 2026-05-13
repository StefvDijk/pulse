import { describe, test, expect } from 'vitest'
import { classifyQuestion } from '@/lib/ai/classifier'

/**
 * Unit tests for the classifier. These complement the eval-harness
 * (scripts/eval-ai.ts) by isolating the keyword-boundary bug-fixes
 * that B2 introduced.
 */

describe('B2 — word-prefix boundary regression', () => {
  test("'wat' should not trigger 'at' as food log", () => {
    expect(classifyQuestion('wat at ik gisteren?')).not.toBe('nutrition_log')
  })

  test("'gaat' should not trigger 'at' as food log", () => {
    expect(classifyQuestion('hoe gaat mijn bench progressie?')).toBe('progress_question')
  })

  test("'koolhydraten' should not trigger 'at' as food log", () => {
    expect(classifyQuestion('moet ik meer koolhydraten eten?')).toBe('nutrition_question')
  })

  test("'zondag' should not trigger 'dag' as greeting", () => {
    expect(classifyQuestion('check-in voor zondag')).toBe('weekly_review')
  })

  test("'caloriebehoefte' should still match 'calorie' (prefix)", () => {
    expect(classifyQuestion('wat is mijn dagelijkse caloriebehoefte?')).toBe('nutrition_question')
  })
})

describe('B2 — injury body-part compounds', () => {
  test("'linkerknie' contains 'knie' (substring match for body parts)", () => {
    expect(classifyQuestion('Mijn linkerknie tikt sinds gisteren bij hurken')).toBe('injury_report')
  })

  test("'rugpijn' contains both 'rug' and 'pijn'", () => {
    expect(classifyQuestion('rugpijn na zwaar deadliften')).toBe('injury_report')
  })

  test("'rechterelleboog' contains 'elleboog'", () => {
    expect(classifyQuestion('rechterelleboog doet pijn bij bench')).toBe('injury_report')
  })
})

describe('B2 — priority ordering', () => {
  test('injury wins over nutrition', () => {
    expect(classifyQuestion('pijn in mijn knie na het eten')).toBe('injury_report')
  })

  test('question form with nutrition concept beats food mention', () => {
    expect(classifyQuestion('hoeveel eiwit zit in kwark?')).toBe('nutrition_question')
  })

  test('schema keyword beats greeting', () => {
    expect(classifyQuestion('hey, maak een trainingsschema')).toBe('schema_request')
  })

  test('greeting with question mark is not simple_greeting', () => {
    expect(classifyQuestion('hoi, hoe gaat het?')).toBe('general_chat')
  })
})
