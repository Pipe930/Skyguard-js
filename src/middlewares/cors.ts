import { Context, HttpMethods, Response } from "../http";
import type { Middleware, RouteHandler } from "../types";

/**
 * Callback contract for dynamic CORS allow/deny decisions.
 *
 * Return `true` to allow the current request origin, `false` to deny it.
 */
type CorsOriginResolver = (
  origin: string | undefined,
  context: Context,
) => boolean | Promise<boolean>;

/**
 * CORS middleware configuration options.
 *
 * These options map to standard CORS response headers and preflight behavior.
 */
export interface CorsOptions {
  /**
   * Allowed origin(s) for cross-origin requests.
   *
   * - `"*"` allows any origin (public).
   * - A specific origin (string) restricts access to that origin.
   * - An array provides a whitelist.
   * - A function implements custom allow/deny logic.
   *
   * Affects: `Access-Control-Allow-Origin`.
   */
  origin?: string | string[] | CorsOriginResolver;

  /**
   * HTTP methods allowed for cross-origin requests.
   *
   * Used in preflight responses.
   *
   * Affects: `Access-Control-Allow-Methods`.
   */
  methods?: HttpMethods[];

  /**
   * Request headers the browser is allowed to send in cross-origin requests.
   *
   * Used in preflight responses (especially when the client sends custom headers
   * such as `Authorization`).
   *
   * Affects: `Access-Control-Allow-Headers`.
   */
  allowedHeaders?: string[];

  /**
   * Response headers that should be exposed to browser JavaScript.
   *
   * By default, browsers do not allow JS to read non-safelisted headers.
   *
   * Affects: `Access-Control-Expose-Headers`.
   */
  exposedHeaders?: string[];

  /**
   * Whether the response can be exposed when credentials are included.
   *
   * Enables sending/receiving cookies and authenticated requests across origins.
   *
   * Affects: `Access-Control-Allow-Credentials`.
   *
   * Important:
   * - When enabled, the final `Access-Control-Allow-Origin` value must not be `"*"`.
   */
  credentials?: boolean;

  /**
   * How long (in seconds) the browser may cache a successful preflight response.
   *
   * Improves performance by reducing repeated OPTIONS requests.
   *
   * Affects: `Access-Control-Max-Age`.
   */
  maxAge?: number;

  /**
   * If `false` (default), the middleware ends OPTIONS requests immediately with 204.
   * If `true`, the request continues down the middleware/handler chain after setting
   * the preflight headers.
   */
  preflightContinue?: boolean;
}

/**
 * Normalizes a header that may be represented as `string[]`.
 *
 * @param value - Header value.
 * @returns A single header value or `undefined`.
 */
const getHeaderValue = (value?: string | string[]): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * Resolves the effective `Access-Control-Allow-Origin` value for a request.
 *
 * @param context - Current HTTP context.
 * @param requestOrigin - Incoming `Origin` header value.
 * @param config - CORS config.
 * @returns Allowed origin value or `null` when denied/not configured.
 */
async function resolveOrigin(
  context: Context,
  requestOrigin: string | undefined,
  config: CorsOptions,
): Promise<string | null> {
  if (!requestOrigin) return null;

  const cleanOrigin = (origin: string) =>
    origin.endsWith("/") ? origin.slice(0, -1) : origin;

  if (typeof config.origin === "function") {
    const result = config.origin(requestOrigin, context);
    const isAllowed = result instanceof Promise ? await result : result;
    return isAllowed ? requestOrigin : null;
  }

  if (!config.origin) {
    return null;
  }

  if (typeof config.origin !== "string" && !Array.isArray(config.origin)) {
    return null;
  }

  if (typeof config.origin === "string") {
    if (config.origin === "*") {
      return config.credentials ? requestOrigin : "*";
    }

    return cleanOrigin(config.origin) === cleanOrigin(requestOrigin)
      ? requestOrigin
      : null;
  }

  if (Array.isArray(config.origin)) {
    return config.origin.map(cleanOrigin).includes(cleanOrigin(requestOrigin))
      ? requestOrigin
      : null;
  }

  return null;
}

/**
 * Native CORS middleware, generates a CORS configuration for the server.
 *
 * @param options - CORS configuration.
 * @returns A `Middleware` function that applies CORS headers to the response.
 *
 * @example
 * import { HttpMethods } from "skyguard-js"
 *
 * app.middleware([
 *   cors({
 *      origin: "http://localhost:3000/",
 *      methods: [HttpMethods.get, HttpMethods.post],
 *      credentials: true,
 *      maxAge: 85000
 *   })
 * ])
 */
export const cors = (options: CorsOptions = {}): Middleware => {
  const config = {
    origin: options.origin,
    methods: options.methods ?? [
      HttpMethods.get,
      HttpMethods.post,
      HttpMethods.put,
      HttpMethods.patch,
      HttpMethods.delete,
      HttpMethods.options,
    ],
    allowedHeaders: options.allowedHeaders ?? ["Content-Type", "Authorization"],
    exposedHeaders: options.exposedHeaders ?? [],
    credentials: options.credentials ?? false,
    maxAge: options.maxAge ?? 86400,
    preflightContinue: options.preflightContinue ?? false,
  };

  return async (context: Context, next: RouteHandler) => {
    const allowedOrigin = await resolveOrigin(
      context,
      getHeaderValue(context.headers.origin),
      config,
    );
    const corsHeaders: Record<string, string> = {};

    if (allowedOrigin) {
      corsHeaders["Access-Control-Allow-Origin"] = allowedOrigin;
      if (allowedOrigin !== "*") corsHeaders["Vary"] = "Origin";
    }

    if (config.credentials)
      corsHeaders["Access-Control-Allow-Credentials"] = "true";

    if (config.exposedHeaders.length)
      corsHeaders["Access-Control-Expose-Headers"] =
        config.exposedHeaders.join(", ");

    if (context.req.method === HttpMethods.options) {
      corsHeaders["Access-Control-Allow-Methods"] = config.methods.join(", ");
      corsHeaders["Access-Control-Allow-Headers"] =
        config.allowedHeaders.join(", ");
      corsHeaders["Access-Control-Max-Age"] = String(config.maxAge);

      if (!config.preflightContinue)
        return new Response()
          .setStatusCode(204)
          .setContent(null)
          .setHeaders(corsHeaders);
    }

    const response = await next(context);

    for (const [key, value] of Object.entries(corsHeaders)) {
      response.setHeader(key, value);
    }

    return response;
  };
};
