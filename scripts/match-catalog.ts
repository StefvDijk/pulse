/**
 * Link exercise_definitions to their exercise_catalog entry via name matching.
 * Run: pnpm run match:catalog
 *
 * Idempotent. Prints an unmatched report; add misses to CATALOG_OVERRIDES and
 * re-run.
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'
import { matchDefinitionToCatalog } from '../src/lib/exercises/catalog-match'
import { CATALOG_OVERRIDES } from '../src/lib/exercises/catalog-overrides'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient<Database>(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/**
 * Fetch every exercise_catalog row. PostgREST caps a single response at
 * `db.max_rows` (1000 locally and by default on Supabase-hosted projects,
 * see supabase/config.toml) regardless of the requested range, so a plain
 * `.select()` silently truncates once the catalog exceeds that cap. Page
 * through with `.range()` to get the full table.
 */
async function fetchAllCatalog(): Promise<{ id: string; name: string }[]> {
  const pageSize = 1000
  const all: { id: string; name: string }[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('exercise_catalog')
      .select('id, name')
      .range(from, from + pageSize - 1)
    if (error) {
      console.error(error.message)
      process.exit(1)
    }
    all.push(...(data ?? []))
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return all
}

async function main() {
  const { data: defs, error: defErr } = await supabase
    .from('exercise_definitions')
    .select('id, name')
  if (defErr) {
    console.error(defErr.message)
    process.exit(1)
  }

  const catalog = await fetchAllCatalog()

  const unmatched: string[] = []
  for (const def of defs ?? []) {
    const result = matchDefinitionToCatalog(def.name, catalog, CATALOG_OVERRIDES)
    if (!result.catalogId) {
      unmatched.push(def.name)
      continue
    }
    const { error } = await supabase
      .from('exercise_definitions')
      .update({ catalog_id: result.catalogId })
      .eq('id', def.id)
    if (error) {
      console.error(`Update failed for ${def.name}:`, error.message)
      process.exit(1)
    }
    console.log(`✓ ${def.name} → ${result.matchedName} (${result.method}, ${result.score.toFixed(2)})`)
  }

  const total = defs?.length ?? 0
  console.log(`\nMatched ${total - unmatched.length}/${total}`)
  if (unmatched.length) {
    console.log('\nUnmatched (add to CATALOG_OVERRIDES):')
    unmatched.forEach((n) => console.log(`  - ${n}`))
  }
}

main()
