import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { classifyQuestion, QUESTION_TYPES } from '@/lib/ai/classifier'
import casesJson from '../../fixtures/ai-eval/cases.json'

// ---------------------------------------------------------------------------
// Golden-prompt eval for the chat message classifier (audit #27).
//
// Replaces the deleted scripts/eval-ai.ts: runs every fixture in
// tests/fixtures/ai-eval/cases.json through classifyQuestion offline (the
// classifier is a pure keyword function — no API calls) and asserts the
// predicted QuestionType matches the golden `expected`. The fixtures are first
// validated through Zod so a malformed or mistyped case fails loudly instead
// of silently skewing the pass rate.
// ---------------------------------------------------------------------------

const questionTypeSchema = z.enum(QUESTION_TYPES)

const caseSchema = z.object({
  id: z.string().min(1),
  // `category` is a free-form grouping label (includes non-QuestionType values
  // like 'edge'); only `expected` must be a legal classifier output.
  category: z.string().min(1),
  input: z.string().min(1),
  expected: questionTypeSchema,
  note: z.string().optional(),
})

const cases = z.array(caseSchema).parse(casesJson)

describe('AI classifier golden-prompt eval', () => {
  it('loads a non-empty, schema-valid fixture set', () => {
    expect(cases.length).toBeGreaterThanOrEqual(39)
  })

  it('has unique case ids', () => {
    const ids = new Set(cases.map((c) => c.id))
    expect(ids.size).toBe(cases.length)
  })

  it.each(cases)('[$id] $category → $expected', (c) => {
    expect(classifyQuestion(c.input)).toBe(c.expected)
  })

  it('classifies 100% of golden prompts correctly', () => {
    const failures = cases.filter((c) => classifyQuestion(c.input) !== c.expected)
    expect(failures.map((f) => `${f.id}: "${f.input}"`)).toEqual([])
  })
})
