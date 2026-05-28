import { describe, expect, it } from 'vitest'
import { isNextBlockQuestionTurn } from '@/components/block-review/message-intent'

describe('block-review next-block message intent', () => {
  it('treats explanation prompts as questions', () => {
    expect(isNextBlockQuestionTurn('Waarom staat face pull erin?')).toBe(true)
    expect(isNextBlockQuestionTurn('Klopt dit volume voor borst?')).toBe(true)
    expect(isNextBlockQuestionTurn('Leg uit waarom donderdag lower is')).toBe(true)
  })

  it('treats edit requests as proposal changes even when phrased as questions', () => {
    expect(isNextBlockQuestionTurn('Kun je lat pulldown vervangen door pull-ups?')).toBe(false)
    expect(isNextBlockQuestionTurn('Maak donderdag lichter')).toBe(false)
    expect(isNextBlockQuestionTurn('Herstel de audit blockers')).toBe(false)
    expect(isNextBlockQuestionTurn('Pas upper B aan met minder volume')).toBe(false)
  })
})
