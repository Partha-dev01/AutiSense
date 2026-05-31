/**
 * Unit tests for the per-user rate limiter.
 *
 * The rate limiter protects Bedrock/Polly routes from cost abuse.
 * Bugs here could either lock out legitimate users or fail to throttle attackers.
 *
 * `check()` is async (DynamoDB-backed with in-memory fallback). In the test
 * env no DYNAMODB_RATE_LIMITS_TABLE is set, so it always takes the synchronous
 * in-memory path — deterministic under fake timers — but the call is still
 * awaited because the public API returns a Promise.
 *
 * Tests cover:
 * - First request always allowed
 * - Requests within limit allowed
 * - Requests exceeding limit blocked (429)
 * - Different keys are independent
 * - Window reset after expiry
 * - Remaining count accuracy
 * - Pre-configured AI and API limiters
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRateLimiter, aiRateLimiter, apiRateLimiter } from "../app/lib/rateLimit";

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request", async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });
    const result = await limiter.check("user-1");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("allows requests up to the max limit", async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });

    expect((await limiter.check("user-1")).allowed).toBe(true);  // 1
    expect((await limiter.check("user-1")).allowed).toBe(true);  // 2
    expect((await limiter.check("user-1")).allowed).toBe(true);  // 3
  });

  it("blocks requests exceeding the max limit", async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });

    await limiter.check("user-1"); // 1
    await limiter.check("user-1"); // 2
    await limiter.check("user-1"); // 3
    const result = await limiter.check("user-1"); // 4 — blocked

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks remaining count correctly", async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });

    expect((await limiter.check("user-1")).remaining).toBe(4);
    expect((await limiter.check("user-1")).remaining).toBe(3);
    expect((await limiter.check("user-1")).remaining).toBe(2);
    expect((await limiter.check("user-1")).remaining).toBe(1);
    expect((await limiter.check("user-1")).remaining).toBe(0);
  });

  it("isolates different keys", async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });

    await limiter.check("user-1"); // 1
    await limiter.check("user-1"); // 2
    expect((await limiter.check("user-1")).allowed).toBe(false); // blocked

    // user-2 should be unaffected
    expect((await limiter.check("user-2")).allowed).toBe(true);
    expect((await limiter.check("user-2")).allowed).toBe(true);
  });

  it("resets after the window expires", async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });

    await limiter.check("user-1"); // 1
    await limiter.check("user-1"); // 2
    expect((await limiter.check("user-1")).allowed).toBe(false); // blocked

    // Advance time past the window
    vi.advanceTimersByTime(61_000);

    // Should be allowed again (new window)
    const result = await limiter.check("user-1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("returns correct resetAt timestamp", async () => {
    vi.setSystemTime(new Date("2026-04-05T00:00:00Z"));
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });

    const result = await limiter.check("user-1");
    expect(result.resetAt).toBe(Date.now() + 60_000);
  });
});

describe("pre-configured limiters", () => {
  it("aiRateLimiter allows 20 requests per minute", async () => {
    // Just verify the first request works — don't exhaust the shared instance
    const result = await aiRateLimiter.check("test-ai-user-" + Math.random());
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(19); // max=20, first used
  });

  it("apiRateLimiter allows 60 requests per minute", async () => {
    const result = await apiRateLimiter.check("test-api-user-" + Math.random());
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59); // max=60, first used
  });
});
