import { spawnSync } from 'node:child_process'
import { buildLocalSupabaseCommand } from '../src/lib/supabase/local-cli'

const args = buildLocalSupabaseCommand(process.argv[2])
const result = spawnSync('supabase', args, { stdio: 'inherit' })

if (result.error) throw result.error
process.exitCode = result.status ?? 1
