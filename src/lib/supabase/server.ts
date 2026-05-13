import { createAdminClient } from './admin'

type SupabaseAdminClient = ReturnType<typeof createAdminClient>

/**
 * Single-user mode: patches auth.getUser() on a Supabase admin client so that
 * all route handlers transparently receive the hardcoded owner user ID.
 *
 * The cast to Record<string, unknown> is unavoidable here: Supabase types
 * `auth` as a class with readonly methods. We are intentionally monkey-patching
 * it to bypass session handling in single-user mode (see CLAUDE.md).
 */
function patchAuthGetUser(client: SupabaseAdminClient, userId: string): void {
  // Single-user mode intentionally widens `auth` to patch getUser; see CLAUDE.md
  ;(client.auth as unknown as Record<string, unknown>).getUser = async () => ({
    data: { user: { id: userId } },
    error: null,
  })
}

/**
 * Single-user mode: returns the admin client (bypasses RLS) with auth.getUser()
 * patched to return the hardcoded owner user ID from PULSE_USER_ID env var.
 * No session/cookie handling needed.
 */
export async function createClient() {
  const admin = createAdminClient()
  const userId = process.env.PULSE_USER_ID

  if (!userId) throw new Error('PULSE_USER_ID is not set')

  patchAuthGetUser(admin, userId)

  return admin
}
