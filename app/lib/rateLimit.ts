/**
 * Rate limiter for API routes — shared DynamoDB atomic counter with an
 * in-memory fallback.
 *
 * The in-memory path only protects within ONE Lambda instance; under Amplify's
 * concurrent scaling each instance keeps its own counter, so the effective
 * limit becomes max × instanceCount. The DynamoDB path keeps a SHARED
 * fixed-window counter (atomic ADD) so the limit holds across all instances.
 *
 * Degradation is graceful: when no table is configured (local dev) or DynamoDB
 * is unavailable, it transparently falls back to the in-memory limiter — same
 * protection as before, never a hard failure / fail-open.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 20 });
 *   const result = await limiter.check(userId);
 *   if (!result.allowed) return NextResponse.json({ error: "Rate limited" }, { status: 429 });
 *
 * Table (env DYNAMODB_RATE_LIMITS_TABLE): PK `rlkey` (S), with DynamoDB TTL
 * enabled on the `exp` (N, epoch seconds) attribute so old window buckets
 * self-purge. No table → in-memory fallback (still works, just per-instance).
 */

import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getAppCredentials, getAppRegion } from "./aws/credentials";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  /** Window duration in milliseconds */
  windowMs: number;
  /** Max requests per window per key */
  max: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const RATE_LIMITS_TABLE = process.env.DYNAMODB_RATE_LIMITS_TABLE || "";

// Shared (lazy) DynamoDB doc client + a short failure cooldown so a DynamoDB
// outage doesn't add latency to every request for more than 30 s.
let docClientPromise: Promise<DynamoDBDocumentClient> | null = null;
let dynamoFailedUntil = 0;

async function getDocClient(): Promise<DynamoDBDocumentClient> {
  if (!docClientPromise) {
    docClientPromise = (async () => {
      const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
      const { DynamoDBDocumentClient } = await import("@aws-sdk/lib-dynamodb");
      const credentials = getAppCredentials();
      const client = new DynamoDBClient({
        region: getAppRegion("ap-south-1"),
        ...(credentials && { credentials }),
      });
      return DynamoDBDocumentClient.from(client);
    })();
  }
  return docClientPromise;
}

function distributedEnabled(): boolean {
  if (!RATE_LIMITS_TABLE) return false;
  // Local dev without any AWS config → skip DynamoDB.
  if (
    process.env.NODE_ENV === "development" &&
    !process.env.AWS_ACCESS_KEY_ID &&
    !process.env.APP_ACCESS_KEY_ID &&
    !process.env.AWS_REGION
  ) {
    return false;
  }
  if (Date.now() < dynamoFailedUntil) return false;
  return true;
}

export function createRateLimiter(options: RateLimiterOptions) {
  // Per-instance in-memory fallback store.
  const store = new Map<string, RateLimitEntry>();
  let lastCleanup = Date.now();

  function cleanup(now: number) {
    if (now - lastCleanup < 60_000) return;
    lastCleanup = now;
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }

  function checkMemory(key: string): RateLimitResult {
    const now = Date.now();
    cleanup(now);
    const existing = store.get(key);

    if (!existing || existing.resetAt <= now) {
      // New window
      store.set(key, { count: 1, resetAt: now + options.windowMs });
      return { allowed: true, remaining: options.max - 1, resetAt: now + options.windowMs };
    }

    existing.count++;
    if (existing.count > options.max) {
      return { allowed: false, remaining: 0, resetAt: existing.resetAt };
    }
    return { allowed: true, remaining: options.max - existing.count, resetAt: existing.resetAt };
  }

  async function checkDistributed(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const bucket = Math.floor(now / options.windowMs);
    const resetAt = (bucket + 1) * options.windowMs;
    const rlkey = `${key}:${bucket}`;

    const { UpdateCommand } = await import("@aws-sdk/lib-dynamodb");
    const docClient = await getDocClient();

    // Atomic increment of the per-(key,window) counter. `count` and `exp` are
    // (potentially) reserved words → always referenced via attribute names.
    const res = await docClient.send(
      new UpdateCommand({
        TableName: RATE_LIMITS_TABLE,
        Key: { rlkey },
        UpdateExpression: "SET #exp = if_not_exists(#exp, :exp) ADD #c :one",
        ExpressionAttributeNames: { "#c": "count", "#exp": "exp" },
        ExpressionAttributeValues: {
          ":one": 1,
          // TTL a little past the window end so DynamoDB auto-purges old buckets.
          ":exp": Math.floor(resetAt / 1000) + 10,
        },
        ReturnValues: "UPDATED_NEW",
      }),
    );

    const count = Number(res.Attributes?.count ?? 1);
    return {
      allowed: count <= options.max,
      remaining: Math.max(0, options.max - count),
      resetAt,
    };
  }

  return {
    async check(key: string): Promise<RateLimitResult> {
      if (distributedEnabled()) {
        try {
          return await checkDistributed(key);
        } catch {
          // DynamoDB unavailable → cool down + fall back to the in-memory
          // limiter so the route keeps (per-instance) protection rather than
          // failing open.
          dynamoFailedUntil = Date.now() + 30_000;
        }
      }
      return checkMemory(key);
    },
  };
}

// Pre-configured limiters for different route types
/** Bedrock/Polly routes — 20 requests per minute per user */
export const aiRateLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });
/** General API routes — 60 requests per minute per user */
export const apiRateLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });
