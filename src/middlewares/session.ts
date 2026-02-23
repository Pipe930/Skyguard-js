import { type SessionStorage, type CookieOptions, Session } from "../sessions";
import type { Middleware } from "../types";

/**
 * Constructor type for `SessionStorage` implementations.
 *
 * Allows injecting different session storage strategies
 * (memory, file, redis, etc.).
 */
type SessionStorageConstructor<T extends SessionStorage = SessionStorage> =
  new (...args: any[]) => T;

/**
 * Parses the `Cookie` header into a key/value object.
 *
 * @param cookieHeader - Raw `Cookie` header value
 * @returns Parsed cookies
 *
 * @example
 * parseCookies("foo=bar; session_id=abc123");
 * // { foo: "bar", session_id: "abc123" }
 */
function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map(cookie => {
      const [key, ...value] = cookie.trim().split("=");
      return [key, decodeURIComponent(value.join("="))];
    }),
  );
}

/**
 * Builds the `Set-Cookie` header value for the session.
 *
 * @param sessionId - Session identifier
 * @param config - Fully resolved cookie configuration
 * @returns Value ready to be used in `Set-Cookie`
 *
 * @example
 * buildSessionCookie("abc123", config);
 * // "session_id=abc123; Max-Age=86400; Path=/; SameSite=Lax; HttpOnly"
 */
function buildSessionCookie(
  sessionId: string,
  config: Required<CookieOptions>,
): string {
  const parts: string[] = [
    `${config.cookieName}=${encodeURIComponent(sessionId)}`,
    `Max-Age=${config.maxAge}`,
    `Path=${config.path}`,
    `SameSite=${config.sameSite}`,
  ];

  if (config.httpOnly) parts.push("HttpOnly");
  if (config.secure) parts.push("Secure");

  return parts.join("; ");
}

/**
 * Session lifecycle middleware implementation.
 *
 * @param StorageClass - `SessionStorage` implementation
 * @param options - Session cookie configuration
 * @returns Session middleware
 *
 * @example
 * app.middlewares([
 *   sessionMiddleware(MemorySessionStorage, {
 *     cookieName: "sid",
 *     maxAge: 86400,
 *   }),
 * ]);
 */
export const sessions = (
  StorageClass: SessionStorageConstructor,
  options: CookieOptions = {},
): Middleware => {
  const timeMaxAge = 86400;
  const config: Required<CookieOptions> = {
    cookieName: options.cookieName ?? "session_id",
    maxAge: options.maxAge ?? timeMaxAge,
    httpOnly: options.httpOnly ?? true,
    secure: options.secure ?? false,
    sameSite: options.sameSite ?? "Lax",
    path: options.path ?? "/",
  };

  return async (request, next) => {
    const cookies = parseCookies(request.headers.cookie || "");
    const sessionId = cookies[config.cookieName];

    const storage = new StorageClass(options.maxAge || timeMaxAge);

    if (sessionId) await storage.load(sessionId);

    const session = new Session(storage);
    request.setSession(session);

    const response = await next(request);

    if (storage.id()) {
      const cookieValue = buildSessionCookie(storage.id(), config);
      response.setHeader("Set-Cookie", cookieValue);
    }

    return response;
  };
};
