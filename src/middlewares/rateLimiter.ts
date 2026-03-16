import { Context, Response } from "../http";
import type { Middleware, RouteHandler } from "../types";
import { TooManyRequestsError } from "../exceptions/httpExceptions";
import { isIP } from "node:net";

type MaybePromise<T> = T | Promise<T>;

/**
 * Mutable counter entry for a single rate-limit key.
 */
export interface RateLimitStoreEntry {
  /** Requests performed in the current window. */
  count: number;
  /** Absolute timestamp (ms) when the current window expires. */
  resetTime: number;
}

/**
 * Pluggable store contract for rate limiting.
 *
 * Use a shared implementation (e.g. Redis) in multi-instance deployments.
 */
export interface RateLimitStore {
  /**
   * Increments the counter for `key` in the active window.
   *
   * @param key - Unique client key.
   * @param windowMs - Active window size in milliseconds.
   * @param now - Current unix timestamp in milliseconds.
   * @returns Updated counter entry for the key.
   */
  increment(
    key: string,
    windowMs: number,
    now: number,
  ): MaybePromise<RateLimitStoreEntry>;

  /**
   * Optional cleanup hook for removing expired entries.
   *
   * @param now - Current unix timestamp in milliseconds.
   */
  cleanup?(now: number): MaybePromise<void>;
}

/**
 * Rate limit middleware configuration.
 */
export interface RateLimitOptions {
  /**
   * Time window in milliseconds where requests are counted.
   * @default 60000
   */
  windowMs?: number;

  /**
   * Maximum number of allowed requests within the window.
   * @default 5
   */
  max?: number;

  /**
   * Error message returned when the limit is exceeded.
   */
  message?: string;

  /**
   * HTTP status code returned when the limit is exceeded.
   * @default 429
   */
  statusCode?: number;

  /**
   * Resolves the identity key used for counting requests.
   */
  keyGenerator?: (context: Context) => string;

  /**
   * Trusts proxy-provided IP headers (`x-forwarded-for`, `x-real-ip`,
   * `cf-connecting-ip`) in the default key generator.
   * @default false
   */
  trustProxy?: boolean;

  /**
   * Custom store implementation. Defaults to in-memory store.
   */
  store?: RateLimitStore;

  /**
   * Periodic cleanup interval for stores that support `cleanup`.
   * @default windowMs
   */
  cleanupIntervalMs?: number;

  /**
   * Max number of keys retained by the built-in in-memory store.
   * @default 50000
   */
  maxKeys?: number;

  /**
   * Optional predicate to skip rate limiting for selected requests.
   */
  skip?: (context: Context) => boolean | Promise<boolean>;

  /**
   * Includes `RateLimit-*` response headers.
   * @default true
   */
  standardHeaders?: boolean;

  /**
   * Includes `X-RateLimit-*` response headers.
   * @default false
   */
  legacyHeaders?: boolean;

  /**
   * Optional custom handler executed when the limit is exceeded.
   */
  handler?: RouteHandler;
}

/**
 * Default in-memory implementation of {@link RateLimitStore}.
 *
 * Use a shared external store (e.g. Redis) for distributed environments.
 */
class MemoryRateLimitStore implements RateLimitStore {
  private readonly store = new Map<string, RateLimitStoreEntry>();

  /**
   * @param maxKeys - Maximum number of retained keys in memory.
   */
  constructor(private readonly maxKeys: number) {}

  /**
   * Increments an in-memory counter for the provided key.
   *
   * If the window is expired (or absent), a new window starts at `now`.
   */
  public increment(
    key: string,
    windowMs: number,
    now: number,
  ): RateLimitStoreEntry {
    let entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      entry = { count: 1, resetTime: now + windowMs };
      this.store.set(key, entry);
      this.trimIfNeeded(now);
      return entry;
    }

    entry.count += 1;
    return entry;
  }

  /**
   * Removes expired entries from the internal map.
   */
  public cleanup(now: number): void {
    for (const [key, value] of this.store.entries()) {
      if (now > value.resetTime) this.store.delete(key);
    }
  }

  /**
   * Enforces `maxKeys` and avoids unbounded memory growth.
   */
  private trimIfNeeded(now: number): void {
    if (this.store.size <= this.maxKeys) return;

    this.cleanup(now);
    while (this.store.size > this.maxKeys) {
      const oldestKey = this.store.keys().next().value as string;
      if (!oldestKey) break;
      this.store.delete(oldestKey);
    }
  }
}

/**
 * Normalizes a candidate IP address into a canonical value.
 *
 * Supported inputs:
 * - Plain IPv4/IPv6
 * - IPv4-mapped IPv6 (`::ffff:x.x.x.x`)
 * - Bracketed IPv6 (`[2001:db8::1]`)
 * - IPv4 with port (`x.x.x.x:port`)
 *
 * @param value - Raw address candidate.
 * @returns Normalized IP, or `null` when the input is not a valid IP.
 */
const normalizeAddress = (value?: string): string | null => {
  if (!value) return null;
  const candidate = value.trim();
  if (!candidate) return null;

  if (isIP(candidate)) return candidate;

  if (candidate.startsWith("::ffff:")) {
    const mapped = candidate.slice("::ffff:".length);
    if (isIP(mapped)) return mapped;
  }

  const withoutBrackets =
    candidate.startsWith("[") && candidate.endsWith("]")
      ? candidate.slice(1, -1)
      : candidate;
  if (isIP(withoutBrackets)) return withoutBrackets;

  const ipv4WithPort = withoutBrackets.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort && isIP(ipv4WithPort[1])) return ipv4WithPort[1];

  return null;
};

/**
 * Returns the first value when a header can be `string | string[]`.
 */
const pickFirstHeaderValue = (value?: string | string[]): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * Parses `x-forwarded-for` into an ordered list of candidates.
 *
 * @param value - Raw `x-forwarded-for` header value.
 * @returns A trimmed list of forwarded addresses.
 */
const parseForwardedFor = (value?: string | string[]): string[] => {
  const firstValue = pickFirstHeaderValue(value);
  if (!firstValue) return [];
  return firstValue
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
};

/**
 * Builds the default key generator used by the rate limiter.
 *
 * Behavior:
 * - `trustProxy: false` -> uses only socket `remoteAddress` (plus host fallback).
 * - `trustProxy: true` -> allows proxy headers in this priority:
 *   1) `cf-connecting-ip`
 *   2) `x-real-ip`
 *   3) first valid item in `x-forwarded-for`
 *   4) socket `remoteAddress` fallback
 *
 * @param trustProxy - Whether proxy headers are trusted.
 * @returns A key generator function for rate-limit identity.
 */
const buildDefaultKeyGenerator =
  (trustProxy: boolean) =>
  (context: Context): string => {
    const remoteAddress = normalizeAddress(context.remoteAddress);
    if (!trustProxy)
      return remoteAddress ?? context.headers.host ?? "anonymous";

    const cfIp = normalizeAddress(
      pickFirstHeaderValue(context.headers["cf-connecting-ip"]),
    );
    if (cfIp) return cfIp;

    const realIp = normalizeAddress(
      pickFirstHeaderValue(context.headers["x-real-ip"]),
    );
    if (realIp) return realIp;

    const forwardedCandidates = parseForwardedFor(
      context.headers["x-forwarded-for"],
    );
    for (const candidate of forwardedCandidates) {
      const trustedIp = normalizeAddress(candidate);
      if (trustedIp) return trustedIp;
    }

    return remoteAddress ?? context.headers.host ?? "anonymous";
  };

/**
 * Generates HTTP headers describing the current rate limit state.
 *
 * This function supports both modern standardized headers (RFC rate limit draft)
 * and legacy headers used by older APIs.
 *
 * Calculated values:
 * - **remaining** → number of requests left in the current window
 * - **retryAfter** → seconds until the window resets
 *
 * Header groups:
 *
 * Standard headers (if `includeStandardHeaders` is enabled):
 * - `RateLimit-Limit`
 * - `RateLimit-Remaining`
 * - `RateLimit-Reset`
 *
 * Legacy headers (if `includeLegacyHeaders` is enabled):
 * - `X-RateLimit-Limit`
 * - `X-RateLimit-Remaining`
 * - `X-RateLimit-Reset`
 *
 * @param limit - Maximum number of allowed requests within the window.
 * @param current - Current request count for the client.
 * @param resetTime - Absolute timestamp (ms) when the window resets.
 * @param now - Current timestamp in milliseconds.
 * @param includeStandardHeaders - Whether to include modern rate limit headers.
 * @param includeLegacyHeaders - Whether to include legacy `X-RateLimit-*` headers.
 * @returns A record of HTTP headers to attach to the response.
 */
const getRateLimitHeaders = (
  limit: number,
  current: number,
  resetTime: number,
  now: number,
  includeStandardHeaders: boolean,
  includeLegacyHeaders: boolean,
): Record<string, string> => {
  const remaining = Math.max(limit - current, 0);
  const retryAfter = Math.max(Math.ceil((resetTime - now) / 1000), 0);

  const headers: Record<string, string> = {};

  if (includeStandardHeaders) {
    headers["RateLimit-Limit"] = String(limit);
    headers["RateLimit-Remaining"] = String(remaining);
    headers["RateLimit-Reset"] = String(retryAfter);
  }

  if (includeLegacyHeaders) {
    headers["X-RateLimit-Limit"] = String(limit);
    headers["X-RateLimit-Remaining"] = String(remaining);
    headers["X-RateLimit-Reset"] = String(Math.floor(resetTime / 1000));
  }

  return headers;
};

/**
 * Creates a configurable request rate-limiting middleware.
 *
 * The middleware tracks incoming requests per client key (usually IP) and
 * enforces a maximum number of requests within a fixed time window.
 *
 * Internally it maintains an **in-memory store** that records:
 * - request count per key
 * - reset timestamp for the current window
 *
 * Notes:
 * - The default implementation uses a **simple in-memory Map**, meaning it is
 *   suitable for single-instance deployments.
 * - For distributed environments (multiple servers), a shared store
 *   (e.g., Redis) would be required.
 *
 * Configurable options include:
 * - `windowMs` → duration of the rate limit window
 * - `max` → maximum requests allowed per window
 * - `keyGenerator` → function used to identify clients
 * - `skip` → optional function to bypass rate limiting for certain requests
 * - `handler` → custom response when the limit is exceeded
 * - `standardHeaders` / `legacyHeaders` → control which rate limit headers are included
 *
 * @param options - Rate limiting configuration.
 * @returns A middleware that enforces request rate limits.
 *
 * @example
 * app.middlewares([
 *   rateLimit({ windowMs: 60_000, max: 100 }),
 * ]);
 */
export const rateLimit = (options: RateLimitOptions = {}): Middleware => {
  const trustProxy = options.trustProxy ?? false;
  const memoryStoreMaxKeys = Math.max(options.maxKeys ?? 50_000, 1);
  const store = options.store ?? new MemoryRateLimitStore(memoryStoreMaxKeys);

  const config = {
    windowMs: options.windowMs ?? 60_000,
    max: options.max ?? 5,
    message: options.message ?? "Too many requests, please try again later.",
    statusCode: options.statusCode ?? 429,
    keyGenerator: options.keyGenerator ?? buildDefaultKeyGenerator(trustProxy),
    skip: options.skip,
    standardHeaders: options.standardHeaders ?? true,
    legacyHeaders: options.legacyHeaders ?? false,
    handler: options.handler,
  };
  const cleanupIntervalMs = Math.max(
    options.cleanupIntervalMs ?? config.windowMs,
    1000,
  );
  let nextCleanupAt = Date.now() + cleanupIntervalMs;

  return async (context: Context, next: RouteHandler) => {
    if (config.skip && (await config.skip(context))) {
      return next(context);
    }

    const now = Date.now();
    if (now >= nextCleanupAt && store.cleanup) {
      await store.cleanup(now);
      nextCleanupAt = now + cleanupIntervalMs;
    }

    const key = config.keyGenerator(context) || "anonymous";
    const entry = await store.increment(key, config.windowMs, now);
    const headers = getRateLimitHeaders(
      config.max,
      entry.count,
      entry.resetTime,
      now,
      config.standardHeaders,
      config.legacyHeaders,
    );

    if (entry.count > config.max) {
      const retryAfter = Math.max(Math.ceil((entry.resetTime - now) / 1000), 0);
      headers["Retry-After"] = String(retryAfter);

      const blockedResponse = config.handler
        ? await config.handler(context)
        : Response.json(
            new TooManyRequestsError(config.message).toJSON(),
          ).setStatusCode(config.statusCode);

      blockedResponse.setHeaders(headers);
      return blockedResponse;
    }

    const response = await next(context);
    response.setHeaders(headers);

    return response;
  };
};
