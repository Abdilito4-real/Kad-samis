import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

export type RateLimitBucket = "auth-sensitive" | "write" | "read" | "bulk-import";

const BUCKET_CONFIG: Record<RateLimitBucket, { limit: number; windowMs: number }> = {
  // Password resets, org/admin-user creation — classic spam/enumeration
  // targets, so the tightest budget.
  "auth-sensitive": { limit: 5, windowMs: 60_000 },
  // Ordinary POST/PATCH/DELETE.
  write: { limit: 30, windowMs: 60_000 },
  // GET.
  read: { limit: 120, windowMs: 60_000 },
  // CSV import — each call can insert many rows, so it gets its own,
  // stricter budget rather than sharing the general "write" one.
  "bulk-import": { limit: 10, windowMs: 60_000 },
};

// --- In-memory fallback -----------------------------------------------
// Used when Upstash isn't configured. Correct for a single long-running
// process (traditional Node server); NOT correct across multiple
// serverless instances, since each invocation on Vercel gets its own
// memory and never sees another instance's counters — that's exactly why
// this whole module prefers Redis when it's available. Still better than
// no limiting at all while UPSTASH_REDIS_REST_URL/TOKEN aren't set yet
// (e.g. before you've created the free Upstash account).
const memoryStore = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = Date.now();

function memoryLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();

  // Sweep expired entries occasionally so this map can't grow unbounded
  // over a long-running dev/single-instance process.
  if (now - lastCleanup > 60_000) {
    lastCleanup = now;
    for (const [k, entry] of memoryStore) {
      if (entry.resetAt <= now) memoryStore.delete(k);
    }
  }

  const entry = memoryStore.get(key);
  if (!entry || entry.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, reset: now + windowMs };
  }
  entry.count += 1;
  return { success: entry.count <= limit, remaining: Math.max(0, limit - entry.count), reset: entry.resetAt };
}

// --- Redis-backed limiters (one per bucket, created lazily) -----------
const limiters = new Map<RateLimitBucket, Ratelimit>();

function getLimiter(bucket: RateLimitBucket): Ratelimit | null {
  if (!redis) return null;
  let limiter = limiters.get(bucket);
  if (!limiter) {
    const { limit, windowMs } = BUCKET_CONFIG[bucket];
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      analytics: true,
      prefix: `ratelimit:${bucket}`,
    });
    limiters.set(bucket, limiter);
  }
  return limiter;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when the window resets. */
  reset: number;
}

/**
 * Checks (and atomically consumes) one request against `bucket`'s budget
 * for `identifier`. Call this first in a route handler and short-circuit
 * with `rateLimitResponse()` when `success` is false — see
 * getClientIdentifier() for the usual identifier.
 */
export async function checkRateLimit(bucket: RateLimitBucket, identifier: string): Promise<RateLimitResult> {
  const config = BUCKET_CONFIG[bucket];
  const limiter = getLimiter(bucket);

  if (limiter) {
    const result = await limiter.limit(identifier);
    return { success: result.success, limit: result.limit, remaining: result.remaining, reset: result.reset };
  }

  const result = memoryLimit(`${bucket}:${identifier}`, config.limit, config.windowMs);
  return { success: result.success, limit: config.limit, remaining: result.remaining, reset: result.reset };
}

/**
 * Best-effort caller identity for rate limiting: the real client IP, read
 * from the headers Vercel's proxy sets (or nginx/similar, if
 * self-hosted). Falls back to a single shared bucket if neither header is
 * present, which is deliberately conservative — rate limiting everyone
 * together is safer than silently not limiting an unidentifiable caller.
 */
export function getClientIdentifier(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

/** Standard 429 response for a failed checkRateLimit() call, with the usual RateLimit-* headers set. */
export function rateLimitResponse(result: RateLimitResult) {
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.reset),
        "Retry-After": String(Math.max(0, Math.ceil((result.reset - Date.now()) / 1000))),
      },
    }
  );
}
