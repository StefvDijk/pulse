import { createAdminClient } from './admin'

/**
 * Single-user mode: returns the admin client (bypasses RLS) with auth.getUser()
 * patched to return the hardcoded owner user ID from PULSE_USER_ID env var.
 * No session/cookie handling needed.
 */
export async function createClient() {
  const admin = createAdminClient()
  const userId = process.env.PULSE_USER_ID

  if (!userId) throw new Error('PULSE_USER_ID is not set')

  // Patch getUser so all existing route handlers work without modification
  ;(admin.auth as unknown as Record<string, unknown>).getUser = async () => ({
    data: { user: { id: userId } },
    error: null,
  })

  return admin
}
