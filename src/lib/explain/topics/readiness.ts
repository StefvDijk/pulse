import { computeReadiness } from '@/lib/aggregations/readiness'
import { registerTopic, type TopicBuilder } from '../registry'
import type { ExplainInputRow } from '../topics'

const LEVEL_LABEL: Record<string, string> = {
  good: 'Goed hersteld',
  normal: 'Normaal',
  fatigued: 'Vermoeid',
  rest_day: 'Rustdag',
}

function formatNumber(n: number, digits = 2): string {
  return n.toLocaleString('nl-NL', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function formatSleep(minutes: number | null): string {
  if (minutes === null) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}u ${String(m).padStart(2, '0')}m`
}

const readiness: TopicBuilder = {
  async build(userId) {
    const data = await computeReadiness(userId)

    const inputs: ExplainInputRow[] = [
      {
        label: 'Acute:Chronic belasting',
        value: data.acwr !== null ? formatNumber(data.acwr) : '—',
        baseline: '0,8 – 1,3',
        source: 'pulse',
      },
      {
        label: 'HRV (vannacht)',
        value: data.hrv !== null ? Math.round(data.hrv).toString() : '—',
        unit: 'ms',
        source: 'apple-health',
      },
      {
        label: 'Rusthartslag',
        value: data.restingHR !== null ? Math.round(data.restingHR).toString() : '—',
        unit: 'bpm',
        source: 'apple-health',
      },
      {
        label: 'Slaap',
        value: formatSleep(data.sleepMinutes),
        source: 'apple-health',
      },
      {
        label: 'Sessies (laatste 3 dagen)',
        value: String(data.recentSessions),
        source: 'pulse',
      },
      {
        label: 'Workout vandaag',
        value: data.todayWorkout ?? 'rust',
        source: 'pulse',
      },
    ]

    return {
      title: 'Herstel & readiness',
      eyebrow: LEVEL_LABEL[data.level] ?? 'Readiness',
      definition:
        'Readiness is een schatting van hoe goed je lichaam vandaag een training aankan. Het combineert je trainingsbelasting, hartritme-variabiliteit, rusthartslag, slaap en hoe vaak je recent hebt getraind.',
      inputs,
      formula:
        'We tellen punten op: ACWR in de optimale band (0,8–1,3) +2 of buiten 0,5–1,5 −2. Slaap ≥7u +1, <6u −1. ≤1 sessie de laatste 3 dagen +1, ≥3 sessies −1. Score ≥2 = goed hersteld, ≥0 = normaal, daaronder = vermoeid. Geen workout gepland = rustdag.',
      sources: ['Apple Health (HAE)', 'Hevy', 'Pulse aggregator'],
      primaryAction: { label: 'Open trainingsschema', href: '/schema' },
    }
  },
  buildAiPrompt(payload) {
    const lines = payload.inputs.map(
      (i) =>
        `- ${i.label}: ${i.value}${i.unit ? ' ' + i.unit : ''}${i.baseline ? ` (norm ${i.baseline})` : ''}`,
    )
    return `Topic: Readiness vandaag (label: ${payload.eyebrow ?? '—'})

INPUTS:
${lines.join('\n')}

Geef een korte interpretatie volgens de toonregels. Begin met wat de readiness-staat vandaag betekent, refereer aan de belangrijkste 1-2 inputs, eindig met één concrete consequentie voor de training van vandaag.`
  },
}

registerTopic('readiness', readiness)
