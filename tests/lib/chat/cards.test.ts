import { describe, it, expect } from 'vitest'
import {
  parseCards,
  makeWritebackCard,
  stripCardTagsFromText,
} from '@/lib/ai/chat/cards'

describe('parseCards', () => {
  it('extracts a valid workout_card', () => {
    const raw =
      'Goed werk! <workout_card>{"title":"Squat Day","date":"2026-06-28","sport":"gym","duration_min":65,"rpe":7,"exercises":[{"name":"Squat","sets":4,"reps":"6","weight_kg":80}],"highlights":["PR 80kg"]}</workout_card>'
    const cards = parseCards(raw)
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ type: 'workout', title: 'Squat Day', sport: 'gym' })
  })

  it('extracts a valid weekplan_card', () => {
    const raw =
      '<weekplan_card>{"week":"2026-W26","sessions":[{"day":"monday","focus":"Upper A","duration_min":55},{"day":"thursday","focus":"Lower A"}]}</weekplan_card>'
    const cards = parseCards(raw)
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ type: 'weekplan_card', week: '2026-W26' })
  })

  it('extracts a valid stat_card', () => {
    const raw =
      '<stat_card>{"label":"Bench 1RM","value":"92.5","unit":"kg","trend":"up","context":"+2.5kg vs vorige blok"}</stat_card>'
    const cards = parseCards(raw)
    expect(cards[0]).toMatchObject({ type: 'stat_card', label: 'Bench 1RM', trend: 'up' })
  })

  it('silently drops a card with invalid JSON', () => {
    const raw = '<workout_card>{not valid json}</workout_card>Goed werk.'
    expect(parseCards(raw)).toHaveLength(0)
  })

  it('silently drops a card that fails Zod validation (missing required sport)', () => {
    const raw = '<workout_card>{"title":"Squat Day","date":"2026-06-28"}</workout_card>'
    expect(parseCards(raw)).toHaveLength(0)
  })

  it('extracts multiple card types from one response', () => {
    const raw =
      '<workout_card>{"title":"Squat","date":"2026-06-28","sport":"gym"}</workout_card>' +
      '<stat_card>{"label":"Volume","value":"14000","unit":"kg"}</stat_card>'
    expect(parseCards(raw)).toHaveLength(2)
  })

  it('returns [] when no card tags are present', () => {
    expect(parseCards('Gewoon een antwoord zonder kaarten.')).toHaveLength(0)
  })
})

describe('makeWritebackCard', () => {
  it('returns a writeback_card with the correct label for nutrition', () => {
    const card = makeWritebackCard('nutrition')
    expect(card).toMatchObject({ type: 'writeback_card', kind: 'nutrition' })
    expect(card.label).toContain('Voeding')
  })

  it('covers all four kinds', () => {
    const kinds = ['nutrition', 'injury', 'schema_generation', 'schema_update'] as const
    for (const kind of kinds) {
      const card = makeWritebackCard(kind)
      expect(card.kind).toBe(kind)
      expect(card.label.length).toBeGreaterThan(3)
    }
  })
})

describe('stripCardTagsFromText', () => {
  it('removes all card tags from clean text', () => {
    const raw =
      'Hier is je plan. <weekplan_card>{"week":"2026-W26","sessions":[]}</weekplan_card> Veel succes!'
    expect(stripCardTagsFromText(raw)).toBe('Hier is je plan.  Veel succes!')
  })

  it('returns text unchanged when no card tags present', () => {
    expect(stripCardTagsFromText('Goed zo!')).toBe('Goed zo!')
  })
})
