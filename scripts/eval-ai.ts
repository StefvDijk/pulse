#!/usr/bin/env tsx
/**
 * Pulse AI eval harness.
 *
 * Usage:
 *   pnpm eval:ai                       # runs all cases
 *   pnpm eval:ai --category=injury     # filter by category
 *   pnpm eval:ai --fail-on=85          # exit 1 if pass rate < 85%
 *
 * What it tests today:
 *   classifyQuestion(text) → expected QuestionType
 *
 * Output:
 *   .claude/audit-output/eval-results/<timestamp>.json
 *
 * Roadmap (sprint 3): extend with prompt-routing assertions, token-budget,
 * tool-call expectations once write-back goes through AI SDK tools.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { classifyQuestion, type QuestionType } from '../src/lib/ai/classifier'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

interface EvalCase {
  id: string
  category: QuestionType | 'edge'
  input: string
  expected: QuestionType
  note?: string
}

interface EvalResult {
  case: EvalCase
  actual: QuestionType
  passed: boolean
  reason?: string
  durationMs: number
}

function runCase(c: EvalCase): EvalResult {
  const start = Date.now()
  const actual = classifyQuestion(c.input)
  const passed = actual === c.expected
  return {
    case: c,
    actual,
    passed,
    reason: passed ? undefined : `expected ${c.expected}, got ${actual}`,
    durationMs: Date.now() - start,
  }
}

function main() {
  const argv = process.argv.slice(2)
  const categoryFilter = argv.find((a) => a.startsWith('--category='))?.split('=')[1]
  // Default: report-only (no exit code based on score). Sprint 3 (B2) raises this to 85.
  const failOn = Number(argv.find((a) => a.startsWith('--fail-on='))?.split('=')[1] ?? 0)

  const casesPath = join(projectRoot, 'tests/fixtures/ai-eval/cases.json')
  const cases = JSON.parse(readFileSync(casesPath, 'utf-8')) as EvalCase[]
  const filtered = categoryFilter ? cases.filter((c) => c.category === categoryFilter) : cases

  console.log(`\nRunning ${filtered.length} cases (filter: ${categoryFilter ?? 'all'})\n`)

  const results = filtered.map(runCase)

  for (const r of results) {
    const icon = r.passed ? 'OK' : 'FAIL'
    const cat = r.case.category.padEnd(20)
    const id = r.case.id.padEnd(22)
    const reason = r.reason ?? ''
    console.log(`[${icon}] ${cat} ${id} ${reason}`)
  }

  const passed = results.filter((r) => r.passed).length
  const passRate = (passed / results.length) * 100

  console.log(`\n${passed}/${results.length} passed (${passRate.toFixed(1)}%)\n`)

  const outDir = join(projectRoot, '.claude/audit-output/eval-results')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, `${Date.now()}.json`)
  writeFileSync(outPath, JSON.stringify({ passRate, results }, null, 2))
  console.log(`Report written to ${outPath}`)

  if (passRate < failOn) {
    console.error(`\nFAILED: pass rate ${passRate.toFixed(1)}% < threshold ${failOn}%`)
    process.exit(1)
  }
}

main()
