/**
 * One-off: seed Stef's user_profile against local Supabase.
 * Idempotent — pass --force to overwrite.
 *
 * Run with: pnpm tsx scripts/seed-profile-once.ts [--force]
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { assertLocalSupabaseTarget } from '../src/lib/supabase/safe-target'

// Tiny inline test-env loader — avoids adding a dotenv dep for a one-off.
function loadEnv() {
  const file = resolve(process.cwd(), '.env.test.local')
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}
loadEnv()

async function main() {
  const force = process.argv.includes('--force')
  assertLocalSupabaseTarget(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    'profile seed',
  )
  const { seedStefProfile } = await import('../src/lib/profile/seed-stef-profile')
  const userId = process.env.PULSE_USER_ID
  if (!userId) throw new Error('PULSE_USER_ID env var missing')

  const result = await seedStefProfile(userId, force)
  if (result.skipped) {
    console.log('Already seeded — pass --force to overwrite.')
  } else {
    console.log('Profile seeded.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
