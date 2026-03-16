import { Context, Response } from "../http";
import type { Middleware, RouteHandler } from "../types";
import { TooManyRequestsError } from "../exceptions/httpExceptions";

interface RateLimitStoreEntry {
  count: number;
  resetTime: number;
}

/**
 * Rate limit middleware configuration.
 */
interface RateLimitOptions {
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
 * Default key generator used by the rate limiter to uniquely identify a client.
 *
 * The function attempts to extract the client IP address from common proxy
 * headers in order of priority:
 *
 * 1. `x-forwarded-for` → typically used by reverse proxies and load balancers.
 *    If multiple IPs are present, the first one is assumed to be the client IP.
 * 2. `x-real-ip` → used by some proxies (e.g., Nginx).
 * 3. `cf-connecting-ip` → used by Cloudflare to forward the original client IP.
 *
 * If none of these headers are available, the request `Host` header is used as
 * a fallback identifier. If that is also missing, `"anonymous"` is returned.
 *
 * @param request - Incoming HTTP request.
 * @returns A string key used to track request counts per client.
 */
const defaultKeyGenerator = (context: Context): string => {
  const forwardedFor = context.headers["x-forwarded-for"];
  const realIp = context.headers["x-real-ip"];
  const cfIp = context.headers["cf-connecting-ip"];

  if (typeof forwardedFor === "string") {
    return forwardedFor.split(",")[0]?.trim() ?? "anonymous";
  }

  if (typeof realIp === "string") return realIp;
  if (typeof cfIp === "string") return cfIp;

  return context.headers.host ?? "anonymous";
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
  const config = {
    windowMs: options.windowMs ?? 60_000,
    max: options.max ?? 5,
    message: options.message ?? "Too many requests, please try again later.",
    statusCode: options.statusCode ?? 429,
    keyGenerator: options.keyGenerator ?? defaultKeyGenerator,
    skip: options.skip,
    standardHeaders: options.standardHeaders ?? true,
    legacyHeaders: options.legacyHeaders ?? false,
    handler: options.handler,
  };

  const store = new Map<string, RateLimitStoreEntry>();

  return async (context: Context, next: RouteHandler) => {
    if (config.skip && (await config.skip(context))) {
      return next(context);
    }

    const now = Date.now();
    const key = config.keyGenerator(context);

    const current = store.get(key);

    if (!current || now > current.resetTime) {
      store.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
      });
    } else {
      current.count += 1;
    }

    const entry = store.get(key);
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
