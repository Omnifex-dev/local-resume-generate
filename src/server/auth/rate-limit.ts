/**
 * Fixed-window in-memory rate limiter.
 *
 * Fine for a single Node process. If the app is scaled horizontally, swap the
 * Map for Redis (same interface) so limits are shared across instances.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
    private readonly maxKeys = 10_000,
  ) {}

  check(key: string): { ok: boolean; retryAfterSec: number } {
    const t = this.now();
    let entry = this.hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + this.windowMs };
      this.hits.set(key, entry);
      if (this.hits.size > this.maxKeys) this.sweep(t);
    }
    entry.count += 1;
    if (entry.count <= this.limit) return { ok: true, retryAfterSec: 0 };
    return { ok: false, retryAfterSec: Math.ceil((entry.resetAt - t) / 1000) };
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  private sweep(t: number): void {
    for (const [k, v] of this.hits) if (v.resetAt <= t) this.hits.delete(k);
  }
}
