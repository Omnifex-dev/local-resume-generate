import { describe, expect, it } from "vitest";
import { RateLimiter } from "@/server/auth/rate-limit";

function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("RateLimiter", () => {
  it("allows up to the limit then blocks", () => {
    const c = clock();
    const rl = new RateLimiter(3, 1000, c.now);
    expect([1, 2, 3].map(() => rl.check("k").ok)).toEqual([true, true, true]);
    const blocked = rl.check("k");
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(1);
  });

  it("resets after the window", () => {
    const c = clock();
    const rl = new RateLimiter(1, 1000, c.now);
    rl.check("k");
    expect(rl.check("k").ok).toBe(false);
    c.advance(1000);
    expect(rl.check("k").ok).toBe(true);
  });

  it("tracks keys independently and supports manual reset", () => {
    const rl = new RateLimiter(1, 1000, clock().now);
    rl.check("a");
    expect(rl.check("b").ok).toBe(true);
    expect(rl.check("a").ok).toBe(false);
    rl.reset("a");
    expect(rl.check("a").ok).toBe(true);
  });
});
