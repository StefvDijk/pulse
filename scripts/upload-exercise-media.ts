/**
 * Upload exercise thumbnails + GIFs to the `exercise-media` Storage bucket.
 * Run: pnpm run upload:catalog-media
 *
 * Reads media from the locally-cloned dataset (see import:catalog).
 * Idempotent — upserts each object; safe to re-run / resume after a failure.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, extname } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const datasetDir = process.env.EXERCISES_DATASET_DIR ?? 'vendor/exercises-dataset'
const BUCKET = 'exercise-media'

const supabase = createClient<Database>(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
}

async function uploadDir(subdir: 'images' | 'videos') {
  const dir = join(datasetDir, subdir)
  const files = readdirSync(dir)
  console.log(`Uploading ${files.length} files from ${subdir}/`)

  let done = 0
  for (const file of files) {
    const contentType = CONTENT_TYPES[extname(file).toLowerCase()]
    if (!contentType) continue
    const body = readFileSync(join(dir, file))
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(`${subdir}/${file}`, body, { contentType, upsert: true })
    if (error) {
      console.error(`Upload failed for ${subdir}/${file}:`, error.message)
      process.exit(1)
    }
    done += 1
    if (done % 100 === 0) console.log(`  ${subdir}: ${done}/${files.length}`)
  }
  console.log(`✓ Uploaded ${done} files from ${subdir}/`)
}

async function main() {
  await uploadDir('images')
  await uploadDir('videos')
  console.log('✓ Media upload complete')
}

main()
