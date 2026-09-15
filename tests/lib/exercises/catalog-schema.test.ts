import { describe, it, expect } from 'vitest'
import { CatalogExerciseSchema, toCatalogRow } from '@/lib/exercises/catalog-schema'

const sample = {
  id: '0001',
  name: '3/4 Sit-Up',
  category: 'waist',
  body_part: 'waist',
  equipment: 'body weight',
  instructions: { en: 'Lie down…' },
  instruction_steps: { en: ['Lie down.', 'Sit up.'], fr: ['Allongez-vous.'] },
  muscle_group: 'abs',
  secondary_muscles: ['hip flexors'],
  target: 'abs',
  media_id: '2gPfomN',
  image: 'images/0001-2gPfomN.jpg',
  gif_url: 'videos/0001-2gPfomN.gif',
  attribution: '© Gym Visual',
  created_at: '2026-01-01T00:00:00Z',
}

describe('CatalogExerciseSchema', () => {
  it('parses a valid record', () => {
    expect(() => CatalogExerciseSchema.parse(sample)).not.toThrow()
  })

  it('rejects a record with a malformed id', () => {
    expect(() => CatalogExerciseSchema.parse({ ...sample, id: '1' })).toThrow()
  })
})

describe('toCatalogRow', () => {
  it('maps dataset fields to DB columns and keeps only English steps', () => {
    const row = toCatalogRow(CatalogExerciseSchema.parse(sample))
    expect(row).toMatchObject({
      id: '0001',
      image_path: 'images/0001-2gPfomN.jpg',
      gif_path: 'videos/0001-2gPfomN.gif',
      instruction_steps: ['Lie down.', 'Sit up.'],
      normalized_name: '3 4 sit up',
    })
  })
})
