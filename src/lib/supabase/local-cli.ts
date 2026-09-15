import { z } from 'zod'

const LocalActionSchema = z.enum(['reset', 'migrate'])

const LOCAL_COMMANDS = {
  reset: ['db', 'reset', '--local'],
  migrate: ['migration', 'up', '--local', '--include-all'],
} as const

/** Build the only Supabase migration commands sanctioned for automation. */
export function buildLocalSupabaseCommand(action: unknown): string[] {
  const parsed = LocalActionSchema.safeParse(action)
  if (!parsed.success) {
    throw new Error(
      'Only local Supabase reset and migration commands are allowed.',
    )
  }

  return [...LOCAL_COMMANDS[parsed.data]]
}
