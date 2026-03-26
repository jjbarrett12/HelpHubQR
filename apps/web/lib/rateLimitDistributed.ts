import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { checkGuestCreateRateLimit, rateLimitKey } from "@/lib/rateLimit";

export { rateLimitKey };

/** Fallback when Upstash is not configured (single instance only). */
function memorySlidingAllow(
  store: Map<string, number[]>,
  key: string,
  max: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const times = store.get(key) ?? [];
  const recent = times.filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    store.set(key, recent);
    return false;
  }
  recent.push(now);
  store.set(key, recent);
  return true;
}

const memProof = new Map<string, number[]>();
const memMutate = new Map<string, number[]>();
const memMgr = new Map<string, number[]>();

let redisSingleton: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisSingleton !== undefined) return redisSingleton;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    redisSingleton = null;
    return null;
  }
  redisSingleton = new Redis({ url, token });
  return redisSingleton;
}

function makeLimiter(
  prefix: string,
  limit: number,
  windowSeconds: number
): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    prefix: `helphub:${prefix}`,
    analytics: false,
  });
}

const guestLimiter = () => makeLimiter("guest", 10, 15 * 60);
const proofSignLimiter = () => makeLimiter("proof_sign", 40, 60);
const mutationLimiter = () => makeLimiter("helphub_mutate", 120, 60);
const managerDecisionLimiter = () => makeLimiter("mgr_approval", 80, 60);

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSec?: number };

async function exec(limiter: Ratelimit | null, key: string, fallback: () => boolean): Promise<RateLimitResult> {
  if (!limiter) {
    return { allowed: fallback() };
  }
  const res = await limiter.limit(key);
  if (!res.success) {
    return { allowed: false, retryAfterSec: res.reset != null ? Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)) : undefined };
  }
  return { allowed: true };
}

/** Guest / public create paths — same key shape as legacy `rateLimitKey`. */
export async function checkGuestRateLimitDistributed(key: string): Promise<RateLimitResult> {
  return exec(guestLimiter(), key, () => checkGuestCreateRateLimit(key));
}

export async function checkProofSignRateLimit(userId: string, organizationId: string): Promise<RateLimitResult> {
  const key = `${organizationId}:${userId}`;
  return exec(proofSignLimiter(), key, () => memorySlidingAllow(memProof, key, 40, 60_000));
}

export async function checkHelpHubMutationRateLimit(userId: string): Promise<RateLimitResult> {
  return exec(mutationLimiter(), userId, () => memorySlidingAllow(memMutate, userId, 120, 60_000));
}

export async function checkManagerApprovalRateLimit(userId: string, organizationId: string): Promise<RateLimitResult> {
  const key = `${organizationId}:${userId}`;
  return exec(managerDecisionLimiter(), key, () => memorySlidingAllow(memMgr, key, 80, 60_000));
}

export function isDistributedRateLimitConfigured(): boolean {
  return getRedis() != null;
}
