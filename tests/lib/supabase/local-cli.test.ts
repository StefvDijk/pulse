import { describe, expect, it } from 'vitest'
import { buildLocalSupabaseCommand } from '@/lib/supabase/local-cli'

describe('buildLocalSupabaseCommand', () => {
  it.each([
    ['reset', ['db', 'reset', '--local']],
    ['migrate', ['migration', 'up', '--local']],
  ] as const)('forces the %s command to the local stack', (action, expected) => {
    expect(buildLocalSupabaseCommand(action)).toEqual(expected)
  })

  it.each(['push', '--linked', 'db push', undefined])(
    'rejects unsupported or remote-capable input: %s',
    (action) => {
      expect(() => buildLocalSupabaseCommand(action)).toThrow(
        /Only local Supabase reset and migration commands are allowed/,
      )
    },
  )
})
