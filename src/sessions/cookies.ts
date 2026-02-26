/**
 * Session cookie configuration options.
 *
 * Defines attributes that control the behavior and security
 * of the session cookie sent to the client.
 *
 * @example
 * const options: CookieOptions = {
 *   cookieName: "session_id",
 *   maxAge: 60 * 60 * 24, // 1 day
 *   httpOnly: true,
 *   secure: true,
 *   sameSite: "Lax",
 *   path: "/",
 * };
 */
export interface CookieOptions {
  /**
   * Cookie lifetime in seconds.
   *
   * Determines how long the browser should keep the cookie
   * before automatically removing it.
   *
   * @default 86400 (1 day)
   */
  maxAge?: number;

  /**
   * Indicates whether the cookie is inaccessible from JavaScript.
   *
   * When enabled, the cookie cannot be read via `document.cookie`,
   * helping mitigate XSS attacks.
   *
   * @default true
   */
  httpOnly?: boolean;

  /**
   * Indicates whether the cookie should only be sent over HTTPS.
   *
   * Should be enabled in production when using HTTPS to prevent
   * cookie exposure over insecure connections.
   *
   * @default false
   */
  secure?: boolean;

  /**
   * Controls when the browser sends the cookie in cross-site requests.
   *
   * - `"Strict"`: sent only in same-site requests
   * - `"Lax"`: sent in top-level navigation (recommended default)
   * - `"None"`: always sent (requires `secure: true`)
   *
   * @default "Lax"
   */
  sameSite?: "Strict" | "Lax" | "None";

  /**
   * Path for which the cookie is valid.
   *
   * The cookie is only sent for requests whose URL
   * matches this path.
   *
   * @default "/"
   */
  path?: string;
}

/**
 * Parses the value of the HTTP `Cookie` header into a key/value object.
 *
 * This utility normalizes the header (which may be a string or an array),
 * splits individual cookies, and URL-decodes their values.
 *
 * It is designed to be tolerant to malformed or empty input and will
 * return an empty object when no cookies are present.
 *
 * @param cookieHeader - Raw `Cookie` header value from the request.
 * Can be either a single string or an array of header values.
 *
 * @returns A record where each key is the cookie name and each value
 * is the decoded cookie value.
 *
 * @example
 * parseCookies("sessionId=abc123; theme=dark");
 * // => { sessionId: "abc123", theme: "dark" }
 *
 * @example
 * parseCookies(undefined);
 * // => {}
 */
export function parseCookies(
  cookieHeader?: string | string[],
): Record<string, string> {
  const raw = Array.isArray(cookieHeader)
    ? cookieHeader.join("; ")
    : cookieHeader;
  if (!raw) return {};

  return Object.fromEntries(
    raw
      .split(";")
      .map(cookie => cookie.trim())
      .filter(Boolean)
      .map(cookie => {
        const [key, ...value] = cookie.split("=");

        try {
          return [key, decodeURIComponent(value.join("="))] as const;
        } catch {
          return [key, value.join("=")] as const;
        }
      }),
  );
}

/**
 * Serializes a cookie name, value, and options into a string suitable
 * for the `Set-Cookie` HTTP response header.
 *
 * The cookie value is automatically URL-encoded. Optional attributes
 * are appended only when provided.
 *
 * Supported attributes:
 * - Max-Age
 * - Path
 * - SameSite
 * - HttpOnly
 * - Secure
 *
 * @param name - Cookie name.
 * @param value - Cookie value (will be URL-encoded).
 * @param options - Optional cookie configuration.
 *
 * @returns A properly formatted `Set-Cookie` header string.
 *
 * @example
 * serializeCookie("sessionId", "abc123", {
 *   httpOnly: true,
 *   secure: true,
 *   path: "/",
 *   maxAge: 3600,
 *   sameSite: "Strict"
 * });
 *
 * // => "sessionId=abc123; Max-Age=3600; Path=/; SameSite=Strict; HttpOnly; Secure"
 */
export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {},
): string {
  const parts: string[] = [`${name}=${encodeURIComponent(value)}`];

  if (typeof options.maxAge === "number")
    parts.push(`Max-Age=${options.maxAge}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");

  return parts.join("; ");
}
