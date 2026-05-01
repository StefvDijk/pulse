import { createHash } from 'node:crypto'
import type { ExplainPayload, ExplainTopic } from './topics'

export interface TopicBuilder {
  build(userId: string, params: Record<string, string>): Promise<Omit<ExplainPayload, 'inputsHash' | 'topic'>>
  buildAiPrompt(payload: Omit<ExplainPayload, 'inputsHash' | 'topic'>): string
}

const registry: Partial<Record<ExplainTopic, TopicBuilder>> = {}

export function registerTopic(topic: ExplainTopic, builder: TopicBuilder): void {
  registry[topic] = builder
}

export function getTopic(topic: ExplainTopic): TopicBuilder | undefined {
  return registry[topic]
}

export function hashInputs(inputs: unknown): string {
  return createHash('sha256').update(JSON.stringify(inputs)).digest('hex').slice(0, 16)
}
