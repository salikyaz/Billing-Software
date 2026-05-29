// Lightweight in-memory fixed-window rate limiter.
// Suitable for a single-instance deployment (the target Hostinger VPS runs one
// Node process under PM2). For multi-instance you'd swap this for Redis.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Returns whether an action keyed by `key` is allowed, consuming one unit.
 * @param key      unique bucket key (e.g. `login:user@example.com`)
 * @param max      max actions allowed per window
 * @param windowMs window length in milliseconds
 */
export function rateLimit(
  key: string,
  max: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: max - existing.count,
    retryAfterSeconds: 0,
  };
}

/** Clear a bucket (e.g. after a successful login). */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

// Periodically evict expired buckets so the map doesn't grow unbounded.
// (guarded so it doesn't run in edge/build contexts without setInterval)
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }, 60_000);
  // Don't keep the process alive just for cleanup.
  if (typeof timer.unref === "function") timer.unref();
}
