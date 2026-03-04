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

interface CsrfConfig {
  cookieName: string;
  bodyField: string;
  headerNames: string[];
  protectedMethods: HttpMethods[];
  validateOrigin: boolean;
  allowedOrigins?: string[];
  requireRefererOnHttps: boolean;
  cookie: CookieOptions;
  tokenGenerator: () => string;
}

const defaultTokenGenerator = () => randomBytes(32).toString("hex");

const normalizeOrigin = (value: string): string => value.replace(/\/+$/, "");

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

const hasInvalidDuplicateHeader = (
  request: Request,
  headerName: string,
): boolean =>
  Array.isArray(request.headers[headerName]) &&
  request.headers[headerName].length !== 1;

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

function safeCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, "utf-8");
  const bBuffer = Buffer.from(b, "utf-8");

  if (aBuffer.length !== bBuffer.length) return false;

  return timingSafeEqual(aBuffer, bBuffer);
}

function isHttpsRequest(request: Request): boolean {
  const forwardedProto = getSingleHeaderValue(request, "x-forwarded-proto");
  if (forwardedProto?.split(",")[0]?.trim().toLowerCase() === "https")
    return true;

  const forwarded = getSingleHeaderValue(request, "forwarded");
  if (forwarded?.toLowerCase().includes("proto=https")) return true;

  return false;
}

function inferRequestOrigin(request: Request, isHttps: boolean): string | null {
  const host = getSingleHeaderValue(request, "host");
  if (!host) return null;

  return `${isHttps ? "https" : "http"}://${host}`;
}

function extractOriginFromReferer(referer: string): string | null {
  try {
    const url = new URL(referer);
    return url.origin;
  } catch {
    return null;
  }
}

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

const buildForbiddenResponse = (message: string): Response => {
  return Response.json({
    message,
    statusCode: 403,
    code: "FORBIDDEN",
  }).setStatusCode(403);
};

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
