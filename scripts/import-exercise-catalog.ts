/**
 * Import the exercise reference catalog into `exercise_catalog`.
 * Run: pnpm run import:catalog
 *
 * Clone the dataset once (gitignored):
 *   git clone https://github.com/hasaneyldrm/exercises-dataset vendor/exercises-dataset
 * Override the location with EXERCISES_DATASET_DIR.
 *
 * Idempotent — upserts on id. Media upload is a separate step (upload:catalog-media).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '../src/types/database'
import { CatalogExerciseSchema, toCatalogRow } from '../src/lib/exercises/catalog-schema'
import { assertCatalogTarget, catalogTargetOptions } from './catalog-target'

const supabaseUrl = assertCatalogTarget(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  'exercise catalog import',
  catalogTargetOptions(process.argv.slice(2)),
)
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!serviceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const datasetDir = process.env.EXERCISES_DATASET_DIR ?? 'vendor/exercises-dataset'
const dryRun = process.argv.includes('--dry-run')

const supabase = createClient<Database>(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const jsonPath = join(datasetDir, 'data', 'exercises.json')
  const raw = JSON.parse(readFileSync(jsonPath, 'utf-8'))
  const records = z.array(CatalogExerciseSchema).parse(raw)
  console.log(`Parsed ${records.length} exercises from ${jsonPath}`)

  const rows = records.map(toCatalogRow)
  const { count: beforeCount, error: countError } = await supabase
    .from('exercise_catalog')
    .select('*', { count: 'exact', head: true })
  if (countError) throw countError
  console.log(`Before: ${beforeCount ?? 0} catalog rows`)
  if (dryRun) {
    console.log(`Dry run: validated ${rows.length} rows; no writes performed`)
    return
  }

  const BATCH = 500
  let upserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const { error } = await supabase
      .from('exercise_catalog')
      .upsert(chunk, { onConflict: 'id' })
    if (error) {
      console.error(`Upsert failed at batch ${i}:`, error.message)
      process.exit(1)
    }
    upserted += chunk.length
    console.log(`Upserted ${upserted}/${rows.length}`)
  }

  const { count: afterCount, error: afterError } = await supabase
    .from('exercise_catalog')
    .select('*', { count: 'exact', head: true })
  if (afterError) throw afterError
  console.log(`✓ Imported ${upserted} catalog rows; after: ${afterCount ?? 0}`)
}

main()
