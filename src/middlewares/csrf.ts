import { randomBytes, timingSafeEqual } from "node:crypto";
import { HttpMethods, Request, Response } from "../http";
import type { CookieOptions } from "../sessions/cookies";
import type { Middleware, RouteHandler } from "../types";

export interface CsrfOptions {
  /**
   * Cookie name used to store the CSRF token.
   * @default "XSRF-TOKEN"
   */
  cookieName?: string;

  /**
   * Body field used as fallback to read token.
   * @default "csrf"
   */
  bodyField?: string;

  /**
   * Header names checked for incoming CSRF token.
   * @default ["x-csrf-token", "x-xsrf-token"]
   */
  headerNames?: string[];

  /**
   * HTTP methods that must pass CSRF validation.
   * @default [POST, PUT, PATCH, DELETE]
   */
  protectedMethods?: HttpMethods[];

  /**
   * Cookie attributes used when issuing token cookie.
   */
  cookie?: CookieOptions;

  /**
   * Enables Origin/Referer verification on protected requests.
   * @default true
   */
  validateOrigin?: boolean;

  /**
   * Allowed origins for Origin/Referer checks. If omitted,
   * middleware falls back to request same-origin based on host/proto.
   */
  allowedOrigins?: string[];

  /**
   * When true and the request is HTTPS, Referer is required if Origin is missing.
   * @default true
   */
  requireRefererOnHttps?: boolean;

  /**
   * Custom token generator.
   */
  tokenGenerator?: () => string;
}

/**
 * Internal configuration structure used by the CSRF middleware.
 *
 * This interface represents the **fully resolved configuration** after user
 * options (`CsrfOptions`) have been normalized and default values applied.
 * It is not typically exposed to end users directly; instead it is produced
 * by the internal `buildConfig()` function and consumed by the middleware
 * during request validation.
 *
 * The configuration defines how CSRF tokens are issued, where they are read
 * from in incoming requests, and how request origin validation is enforced.
 */
interface CsrfConfig {
  /**
   * Name of the cookie used to store the CSRF token.
   *
   * The token stored in this cookie is compared against the token sent by the
   * client (usually via header or body field) following the **double-submit
   * cookie** pattern.
   */
  cookieName: string;

  /**
   * Field name used to read the CSRF token from the request body.
   *
   * This acts as a fallback when the token is not provided through headers.
   * Common in HTML forms where the token is sent as a hidden input.
   */
  bodyField: string;

  /**
   * List of HTTP header names that may contain the CSRF token.
   *
   * The middleware checks these headers in order and uses the first valid
   * token found.
   */
  headerNames: string[];

  /**
   * HTTP methods that require CSRF validation.
   *
   * Safe/idempotent methods like GET or HEAD are typically excluded.
   */
  protectedMethods: HttpMethods[];

  /**
   * Enables validation of the request origin using `Origin` and/or `Referer`
   * headers.
   *
   * When enabled, the middleware ensures that requests originate from
   * trusted domains to mitigate cross-site request forgery attacks.
   */
  validateOrigin: boolean;

  /**
   * Explicit list of allowed origins.
   *
   * If provided, requests must match one of these normalized origins.
   * If omitted, the middleware may infer an origin from the request's
   * `Host` header.
   */
  allowedOrigins?: string[];

  /**
   * Requires the `Referer` header for HTTPS requests when the `Origin`
   * header is missing.
   *
   * Some browsers omit the `Origin` header for certain requests; in those
   * cases the `Referer` header can still be used to determine the request
   * origin.
   */
  requireRefererOnHttps: boolean;

  /**
   * Cookie configuration used when issuing the CSRF token cookie.
   */
  cookie: CookieOptions;

  /**
   * Function responsible for generating new CSRF tokens.
   *
   * The default implementation typically uses cryptographically secure
   * random bytes (e.g., `randomBytes`) to produce a high-entropy token.
   */
  tokenGenerator: () => string;
}

/**
 * Generates a cryptographically strong CSRF token.
 *
 * Default implementation uses 32 random bytes encoded as hex, yielding a
 * 64-character token suitable for double-submit cookie style CSRF protection.
 *
 * @returns A new CSRF token string.
 */
const defaultTokenGenerator = () => randomBytes(32).toString("hex");

/**
 * Normalizes an origin-like string by removing trailing slashes.
 *
 * This helps make origin comparisons stable across minor formatting differences
 * (e.g. `https://example.com/` vs `https://example.com`).
 *
 * @param value - Origin string to normalize.
 * @returns Normalized origin string without trailing slashes.
 */
const normalizeOrigin = (value: string): string => value.replace(/\/+$/, "");

/**
 * Builds a fully normalized CSRF configuration object from user-provided options.
 *
 * @param options - User-provided CSRF options.
 * @returns A complete `CsrfConfig` with defaults applied.
 */
const buildConfig = (options: CsrfOptions): CsrfConfig => ({
  cookieName: options.cookieName ?? "XSRF-TOKEN",
  bodyField: options.bodyField ?? "csrf",
  headerNames: options.headerNames ?? ["x-csrf-token", "x-xsrf-token"],
  protectedMethods: options.protectedMethods ?? [
    HttpMethods.post,
    HttpMethods.put,
    HttpMethods.patch,
    HttpMethods.delete,
  ],
  validateOrigin: options.validateOrigin ?? true,
  allowedOrigins: options.allowedOrigins?.map(normalizeOrigin),
  requireRefererOnHttps: options.requireRefererOnHttps ?? true,
  cookie: {
    path: options.cookie?.path ?? "/",
    sameSite: options.cookie?.sameSite ?? "Lax",
    secure: options.cookie?.secure ?? false,
    httpOnly: options.cookie?.httpOnly ?? false,
    maxAge: options.cookie?.maxAge,
  },
  tokenGenerator: options.tokenGenerator ?? defaultTokenGenerator,
});

/**
 * Reads a single-valued HTTP header from the request safely.
 *
 * If the header is absent, returns `null`. If the header is represented
 * as an array, this function only accepts the case where the array has
 * exactly one value; otherwise it returns `null` to avoid ambiguity.
 *
 * @param request - Incoming request.
 * @param headerName - Header key to read (as stored in `request.headers`).
 * @returns The header value if exactly one is present, otherwise `null`.
 */
function getSingleHeaderValue(
  request: Request,
  headerName: string,
): string | null {
  const value = request.headers[headerName];
  if (!value) return null;

  if (Array.isArray(value)) {
    if (value.length !== 1) return null;
    return value[0] ?? null;
  }

  return value;
}

/**
 * Detects an invalid duplicate header for a given header name.
 *
 * Some request parsers represent repeated headers as an array. For security-
 * sensitive headers (CSRF token, Origin, Referer), duplicates can be used for
 * request smuggling / header confusion depending on the stack.
 *
 * This function returns `true` when the header exists as an array with a length
 * other than 1 (i.e., duplicated or empty).
 *
 * @param request - Incoming request.
 * @param headerName - Header key to inspect.
 * @returns `true` if duplicates/invalid array form exist, otherwise `false`.
 */
const hasInvalidDuplicateHeader = (
  request: Request,
  headerName: string,
): boolean =>
  Array.isArray(request.headers[headerName]) &&
  request.headers[headerName].length !== 1;

/**
 * Extracts a CSRF token from the first matching header in `headerNames`.
 *
 * Iterates over the configured header names and returns the first non-empty,
 * single-valued header found.
 *
 * @param request - Incoming request.
 * @param headerNames - List of candidate header names to check.
 * @returns The token value if found, otherwise `null`.
 */
function getHeaderToken(
  request: Request,
  headerNames: string[],
): string | null {
  for (const headerName of headerNames) {
    const value = getSingleHeaderValue(request, headerName);
    if (value) return value;
  }

  return null;
}

/**
 * Compares two strings using a constant-time comparison primitive.
 *
 * This reduces timing side-channel leakage (e.g., an attacker inferring partial
 * token values by measuring comparison time).
 *
 * Note: lengths are checked first; unequal lengths fail fast.
 *
 * @param a - Expected value.
 * @param b - Provided value.
 * @returns `true` if equal, otherwise `false`.
 */
function safeCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, "utf-8");
  const bBuffer = Buffer.from(b, "utf-8");

  if (aBuffer.length !== bBuffer.length) return false;

  return timingSafeEqual(aBuffer, bBuffer);
}

/**
 * Determines whether the original request was made over HTTPS.
 *
 * This is commonly inferred behind proxies/load balancers using:
 * - `x-forwarded-proto: https`
 * - `forwarded: ...;proto=https`
 *
 * @param request - Incoming request.
 * @returns `true` if HTTPS is inferred, otherwise `false`.
 */
function isHttpsRequest(request: Request): boolean {
  const forwardedProto = getSingleHeaderValue(request, "x-forwarded-proto");
  if (forwardedProto?.split(",")[0]?.trim().toLowerCase() === "https")
    return true;

  const forwarded = getSingleHeaderValue(request, "forwarded");
  if (forwarded?.toLowerCase().includes("proto=https")) return true;

  return false;
}

/**
 * Infers the request origin using the `Host` header and an HTTPS flag.
 *
 * This is used as a fallback to construct an allowlist when explicit
 * `allowedOrigins` are not provided.
 *
 * @param request - Incoming request.
 * @param isHttps - Whether the request is considered HTTPS.
 * @returns An origin string like `https://example.com`, or `null` if `Host` is missing.
 */
function inferRequestOrigin(request: Request, isHttps: boolean): string | null {
  const host = getSingleHeaderValue(request, "host");
  if (!host) return null;

  return `${isHttps ? "https" : "http"}://${host}`;
}

/**
 * Extracts the origin (scheme + host + port) from a Referer header value.
 *
 * @param referer - The raw Referer header.
 * @returns The parsed origin (e.g., `https://example.com`) or `null` if invalid.
 */
function extractOriginFromReferer(referer: string): string | null {
  try {
    const url = new URL(referer);
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Validates that security-sensitive headers do not appear in an invalid duplicated form.
 *
 * If any are detected as duplicated/ambiguous, returns an error message to be
 * used in a forbidden response.
 *
 * @param request - Incoming request.
 * @param headerNames - Token header names to validate for duplication.
 * @returns An error message string, or `null` if headers look safe.
 */
function validateDuplicateSecurityHeaders(
  request: Request,
  headerNames: string[],
): string | null {
  if (
    headerNames.some(headerName =>
      hasInvalidDuplicateHeader(request, headerName),
    )
  ) {
    return "Invalid CSRF token header format";
  }

  if (
    hasInvalidDuplicateHeader(request, "origin") ||
    hasInvalidDuplicateHeader(request, "referer")
  ) {
    return "Invalid Origin/Referer headers";
  }

  return null;
}

/**
 * Validates request origin using `Origin` and/or `Referer` headers.
 *
 * @param request - Incoming request.
 * @param config - Resolved CSRF configuration.
 * @returns An error message string, or `null` if origin is acceptable.
 */
function validateOriginHeaders(
  request: Request,
  config: CsrfConfig,
): string | null {
  if (!config.validateOrigin) return null;

  const httpsRequest = isHttpsRequest(request);
  const inferredOrigin = inferRequestOrigin(request, httpsRequest);
  const allowedOrigins =
    config.allowedOrigins ??
    (inferredOrigin ? [normalizeOrigin(inferredOrigin)] : []);

  const originHeader = getSingleHeaderValue(request, "origin");
  const refererHeader = getSingleHeaderValue(request, "referer");

  if (
    !originHeader &&
    httpsRequest &&
    config.requireRefererOnHttps &&
    !refererHeader
  ) {
    return "Missing Referer header for HTTPS request";
  }

  const candidateOrigin = originHeader
    ? normalizeOrigin(originHeader)
    : refererHeader
      ? extractOriginFromReferer(refererHeader)
      : null;

  if (!candidateOrigin) return "Missing or invalid request origin";

  if (!allowedOrigins.includes(normalizeOrigin(candidateOrigin))) {
    return "Origin/Referer is not allowed";
  }

  return null;
}

/**
 * Validates the CSRF token for a request using a double-submit cookie strategy.
 *
 * Token resolution:
 * - Prefer the first matching token from configured headers.
 * - Fallback to a token provided in the request body field (`config.bodyField`).
 *
 * Comparison:
 * - Fails if the provided token is not a string.
 * - Uses constant-time comparison via `safeCompare`.
 *
 * @param request - Incoming request.
 * @param config - Resolved CSRF configuration.
 * @param expectedToken - The server-issued token (typically from cookie or generator).
 * @returns An error message string, or `null` if the token is valid.
 */
function validateCsrfToken(
  request: Request,
  config: CsrfConfig,
  expectedToken: string,
): string | null {
  const tokenFromHeader = getHeaderToken(request, config.headerNames);
  const tokenFromBody = request.body[config.bodyField] as string;
  const providedToken = tokenFromHeader ?? tokenFromBody;

  if (
    typeof providedToken !== "string" ||
    !safeCompare(expectedToken, providedToken)
  ) {
    return "Invalid CSRF token";
  }

  return null;
}

/**
 * Builds a standardized HTTP 403 JSON response for CSRF failures.
 *
 * @param message - Human-readable error message explaining why the request was rejected.
 * @returns A `Response` configured with JSON body and status code 403.
 */
const buildForbiddenResponse = (message: string): Response => {
  return Response.json({
    message,
    statusCode: 403,
    code: "FORBIDDEN",
  }).setStatusCode(403);
};

/**
 * CSRF protection middleware using a **double-submit cookie** pattern.
 *
 * High-level flow:
 * - Builds a normalized configuration from user options.
 * - Retrieves an existing CSRF token from a cookie, or issues a new one using `tokenGenerator`.
 * - For protected HTTP methods:
 *   1) rejects ambiguous duplicate security headers,
 *   2) optionally validates request Origin/Referer against an allowlist,
 *   3) validates the provided CSRF token (header or body) against the issued token.
 * - Ensures the CSRF cookie is present on the response (set only when missing).
 *
 * This middleware is designed to be framework-agnostic but assumes:
 * - `request.cookies` provides parsed cookies
 * - `request.body` provides parsed body values (for token-from-body fallback)
 * - `request.headers` supports either string or string[] header values
 *
 * @param options - Optional CSRF configuration overrides.
 * @returns A middleware that enforces CSRF checks and sets/maintains the CSRF cookie.
 */
export const csrf = (options: CsrfOptions = {}): Middleware => {
  const config = buildConfig(options);

  return async (request: Request, next: RouteHandler) => {
    const methodRequiresCheck = config.protectedMethods.includes(
      request.method,
    );
    const tokenFromCookie = request.cookies[config.cookieName];
    const issuedToken = tokenFromCookie || config.tokenGenerator();

    const appendCsrfCookie = (response: Response): Response => {
      if (!tokenFromCookie) {
        response.setCookie(config.cookieName, issuedToken, config.cookie);
      }

      return response;
    };

    if (methodRequiresCheck) {
      const validationError =
        validateDuplicateSecurityHeaders(request, config.headerNames) ??
        validateOriginHeaders(request, config) ??
        validateCsrfToken(request, config, issuedToken);

      if (validationError) {
        return appendCsrfCookie(buildForbiddenResponse(validationError));
      }
    }

    const response = await next(request);
    return appendCsrfCookie(response);
  };
};
