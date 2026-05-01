import { registerTopic, type TopicBuilder } from '../registry'

const demo: TopicBuilder = {
  async build() {
    return {
      title: 'Voorbeeld-uitleg',
      eyebrow: 'Demo',
      definition:
        'Dit is een placeholder-topic om de Explain Layer end-to-end te testen.',
      inputs: [
        { label: 'HRV (vannacht)', value: '58', unit: 'ms', baseline: '62', source: 'apple-health' },
        { label: 'RHR (vannacht)', value: '54', unit: 'bpm', baseline: '52', source: 'apple-health' },
        { label: 'Slaap', value: '6u 52m', baseline: '7u 30m', source: 'apple-health' },
        { label: 'ACWR (7d/28d)', value: '1,18', baseline: '0,8 – 1,3', source: 'pulse' },
      ],
      formula:
        'Voor dit demo-topic zijn de cijfers verzonnen. In echte topics komt hier de berekening in mensentaal.',
      sources: ['Apple Health (HAE)', 'Pulse aggregator'],
    }
  },
  buildAiPrompt(payload) {
    const lines = payload.inputs.map(
      (i) => `- ${i.label}: ${i.value}${i.unit ? ' ' + i.unit : ''}${i.baseline ? ` (baseline ${i.baseline})` : ''}`,
    )
    return `Topic: ${payload.title}\n\nINPUTS:\n${lines.join('\n')}\n\nGeef een korte interpretatie volgens de toonregels.`
  },
}

registerTopic('demo', demo)
