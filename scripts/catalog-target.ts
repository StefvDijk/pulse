import { assertLocalSupabaseTarget } from '../src/lib/supabase/safe-target'

interface CatalogTargetOptions {
  production: boolean
  expectedProjectRef?: string
  confirmation?: string
}

/**
 * Catalog maintenance is local by default. A hosted target requires three
 * independent signals: --production, the expected project ref in env, and an
 * exact command-line confirmation. This makes an inherited production URL
 * insufficient to trigger writes by accident.
 */
export function assertCatalogTarget(
  target: string | undefined,
  operation: string,
  options: CatalogTargetOptions,
): string {
  if (!options.production) return assertLocalSupabaseTarget(target, operation)
  if (!target) throw new Error(`Refusing ${operation}: Supabase URL is missing.`)

  const ref = options.expectedProjectRef
  if (!ref || !/^[a-z0-9]{20}$/.test(ref)) {
    throw new Error(
      `Refusing ${operation}: PULSE_PRODUCTION_SUPABASE_PROJECT_REF is missing or invalid.`,
    )
  }
  if (options.confirmation !== ref) {
    throw new Error(
      `Refusing ${operation}: pass --confirm-project=${ref} to confirm the hosted target.`,
    )
  }

  let url: URL
  try {
    url = new URL(target)
  } catch {
    throw new Error(`Refusing ${operation}: Supabase URL is invalid.`)
  }
  if (url.protocol !== 'https:' || url.hostname !== `${ref}.supabase.co`) {
    throw new Error(
      `Refusing ${operation}: ${url.hostname} does not match the confirmed Supabase project.`,
    )
  }
  return target
}

export function catalogTargetOptions(args: string[]): CatalogTargetOptions {
  const confirmation = args
    .find((arg) => arg.startsWith('--confirm-project='))
    ?.slice('--confirm-project='.length)
  return {
    production: args.includes('--production'),
    expectedProjectRef: process.env.PULSE_PRODUCTION_SUPABASE_PROJECT_REF,
    confirmation,
  }
}
