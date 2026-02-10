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
   * Cookie name.
   *
   * Used to identify the session cookie on the client.
   *
   * @default "session_id"
   */
  cookieName?: string;

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
