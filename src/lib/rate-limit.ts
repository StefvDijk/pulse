/**
 * Simple in-memory rate limiter for serverless functions.
 * With Vercel Fluid Compute, function instances are reused across requests,
 * so per-instance state provides reasonable protection for a single-user app.
 *
 * For multi-user or high-traffic apps, use @upstash/ratelimit with Redis instead.
 */

interface TokenBucket {
  tokens: number
  lastRefill: number
}

const buckets = new Map<string, TokenBucket>()

interface RateLimitOptions {
  /** Max requests in the window */
  limit: number
  /** Window size in milliseconds */
  windowMs: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetMs: number
}

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now - bucket.lastRefill >= options.windowMs) {
    buckets.set(key, { tokens: options.limit - 1, lastRefill: now })
    return { allowed: true, remaining: options.limit - 1, resetMs: options.windowMs }
  }

  if (bucket.tokens <= 0) {
    const resetMs = options.windowMs - (now - bucket.lastRefill)
    return { allowed: false, remaining: 0, resetMs }
  }

  const updated = { ...bucket, tokens: bucket.tokens - 1 }
  buckets.set(key, updated)
  return {
    allowed: true,
    remaining: updated.tokens,
    resetMs: options.windowMs - (now - bucket.lastRefill),
  }
}
