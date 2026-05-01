import { z } from 'zod'

export const ExplainTopicSchema = z.enum([
  'demo',
  'readiness',
  'workload',
  'hrv',
  'rhr',
  'sleep',
  'weekday',
  'nutrition-day',
])

export type ExplainTopic = z.infer<typeof ExplainTopicSchema>

export interface ExplainInputRow {
  label: string
  value: string
  unit?: string
  baseline?: string
  source?: 'hevy' | 'apple-health' | 'manual' | 'pulse'
  capturedAt?: string
}

export interface ExplainPayload {
  topic: ExplainTopic
  title: string
  eyebrow?: string
  definition: string
  inputs: ExplainInputRow[]
  formula: string
  sources: string[]
  inputsHash: string
  primaryAction?: { label: string; href: string }
}
