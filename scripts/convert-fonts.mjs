#!/usr/bin/env node
/**
 * One-shot conversion: SF Pro Display .OTF → .woff2
 *
 * Requires: Python 3 + `fonttools` and `brotli` packages.
 *   pip install fonttools brotli
 *
 * Usage:
 *   node scripts/convert-fonts.mjs            # convert only
 *   node scripts/convert-fonts.mjs --delete-otf  # convert then delete OTFs
 */
import { execSync } from 'node:child_process'
import { readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'public/sf-pro-display'

/**
 * Maps uppercase OTF filename stems (without extension) to the canonical
 * output woff2 filename stem. Italic weights are skipped.
 */
const OTF_TO_WOFF2 = {
  SFPRODISPLAYREGULAR:  'SF-Pro-Display-Regular',
  SFPRODISPLAYMEDIUM:   'SF-Pro-Display-Medium',
  SFPRODISPLAYSEMIBOLD: 'SF-Pro-Display-Semibold',
  SFPRODISPLAYBOLD:     'SF-Pro-Display-Bold',
}

function ensureFontTools() {
  try {
    execSync('python3 -c "import fontTools, brotli"', { stdio: 'pipe' })
  } catch {
    console.error('Missing dependency. Install with:')
    console.error('  pip install fonttools brotli')
    process.exit(1)
  }
}

function convert() {
  ensureFontTools()

  const otfFiles = readdirSync(DIR).filter((f) => f.toUpperCase().endsWith('.OTF'))
  if (otfFiles.length === 0) {
    console.log('No .OTF files found in', DIR)
    return
  }

  let converted = 0
  for (const otf of otfFiles) {
    const upper = otf.toUpperCase()

    // Skip italic weights
    if (upper.includes('ITALIC')) {
      console.log('Skipping italic:', otf)
      continue
    }

    // Match against known stems (strip .OTF extension)
    const stem = upper.replace(/\.OTF$/, '')
    const outName = OTF_TO_WOFF2[stem]
    if (!outName) {
      console.log('Skipping (not Regular/Medium/Semibold/Bold):', otf)
      continue
    }

    const src = join(DIR, otf)
    const out = join(DIR, `${outName}.woff2`)
    console.log(`Converting ${otf} → ${outName}.woff2`)
    execSync(`python3 -m fontTools.ttLib.woff2 compress -o "${out}" "${src}"`, {
      stdio: 'inherit',
    })
    converted++
  }

  console.log(`\n${converted} file(s) converted. Verify .woff2 files in ${DIR}`)

  if (process.argv.includes('--delete-otf')) {
    for (const otf of otfFiles) {
      unlinkSync(join(DIR, otf))
      console.log('Deleted', otf)
    }
  }
}

convert()
