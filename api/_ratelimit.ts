// Best-effort in-memory rate limiter (scoped to a single serverless instance).
// NOTE: on Vercel each instance has its own memory and cold starts reset it,
// so this is a first layer, not a hard guarantee. For durable, cross-instance
// limits back this with Vercel KV / Upstash Redis.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Returns true if the request is allowed, false if the limit is exceeded.
 * @param key    unique caller key (e.g. `coach:<userId>`)
 * @param max    max requests allowed within the window
 * @param windowMs window length in milliseconds
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count += 1;
  return true;
}
