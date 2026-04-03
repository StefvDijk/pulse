/**
 * Single-user mode: returns the hardcoded owner user ID.
 * Set PULSE_USER_ID in .env.local (local) or Vercel env vars (production).
 */
export function getCurrentUserId(): string {
  const id = process.env.PULSE_USER_ID
  if (!id) throw new Error('PULSE_USER_ID is not set')
  return id
}
