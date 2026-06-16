import { describe, expect, it } from 'vitest'
import { parseAiJson } from '@/lib/ai/parse-ai-json'

describe('parseAiJson', () => {
  it('parses plain JSON', () => {
    expect(parseAiJson('{"calories":685,"confidence":"high"}')).toEqual({
      calories: 685,
      confidence: 'high',
    })
  })

  it('strips a ```json fenced block (the nutrition 500 repro)', () => {
    const raw = '```json\n{\n  "calories": 685,\n  "protein_g": 52\n}\n```'
    expect(parseAiJson(raw)).toEqual({ calories: 685, protein_g: 52 })
  })

  it('strips a bare ``` fence', () => {
    expect(parseAiJson('```\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('recovers JSON wrapped in stray prose', () => {
    expect(parseAiJson('Here you go: {"a":1} — hope that helps')).toEqual({ a: 1 })
  })

  it('throws a clear error when there is no JSON', () => {
    expect(() => parseAiJson('sorry, I cannot help')).toThrow(/did not contain valid JSON/)
  })
})
