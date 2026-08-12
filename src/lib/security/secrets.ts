import { createHash, timingSafeEqual } from 'node:crypto'

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest()
}

/** Compare secrets without leaking matching-prefix or length information. */
export function secretsMatch(
  provided: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!provided || !expected) return false
  return timingSafeEqual(digest(provided), digest(expected))
}

/** Validate an exact `Authorization: Bearer <secret>` credential. */
export function validBearerSecret(
  authorization: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!authorization?.startsWith('Bearer ')) return false
  return secretsMatch(authorization.slice('Bearer '.length), expected)
}
