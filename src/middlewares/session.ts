import { Session, type SessionStorage } from "../sessions";
import {
  parseCookies,
  serializeCookie,
  type CookieOptions,
} from "../sessions/cookies";
import { UnauthorizedError } from "../exceptions/httpExceptions";
import type { Middleware } from "../types";

/**
 * Constructor type for `SessionStorage` implementations.
 */
type SessionStorageConstructor<T extends SessionStorage = SessionStorage> =
  new (...args: any[]) => T;

/**
 * Options inspired by express-session and adapted to Skyguard.
 */
export interface SessionOptions {
  /**
   * Name of the cookie that carries the session id.
   * @default "connect.sid"
   */
  name?: string;

  /**
   * Enables issuing a fresh session cookie on every response.
   * @default false
   */
  rolling?: boolean;

  /**
   * Save a cookie even if the session was never initialized with data.
   * @default false
   */
  saveUninitialized?: boolean;

  /**
   * Session cookie attributes.
   */
  cookie?: CookieOptions;
}

/**
 * Attempts to load a session from a cookie value into the provided storage.
 *
 * If `cookieValue` is missing, this is a no-op.
 *
 * If the storage rejects with `UnauthorizedError` (e.g., invalid or expired session),
 * the error is swallowed and the request proceeds as unauthenticated/uninitialized.
 *
 * Any other error type is treated as unexpected and is re-thrown.
 *
 * @param storage - Session storage instance used to load the session.
 * @param cookieValue - Session id extracted from the request cookie.
 * @throws Unknown errors coming from the storage layer (non-UnauthorizedError).
 */
async function loadSessionFromCookie(
  storage: SessionStorage,
  cookieValue: string | undefined,
): Promise<void> {
  if (!cookieValue) return;

  try {
    await storage.load(cookieValue);
  } catch (error) {
    if (error instanceof UnauthorizedError) return;
    throw error;
  }
}

/**
 * Session lifecycle middleware.
 *
 * API inspired by `express-session`, adapted to the Skyguard architecture.
 *
 * Cookie emission rules:
 * - A cookie is set when a session id exists AND at least one of the following is true:
 *   - `rolling` is enabled (refresh cookie every request),
 *   - `saveUninitialized` is enabled (always create/set cookie when no prior session),
 *   - the session was created during this request.
 *
 * @param StorageClass - Session storage constructor used per request.
 * @param options - Raw session middleware options.
 * @returns A Skyguard `Middleware` that manages session load/save and cookie IO.
 */
export const sessions = (
  StorageClass: SessionStorageConstructor,
  options: SessionOptions = {},
): Middleware => {
  const config = {
    name: options.name ?? "connect.sid",
    rolling: options.rolling ?? false,
    saveUninitialized: options.saveUninitialized ?? false,
    cookie: {
      maxAge: options.cookie?.maxAge ?? 86400,
      httpOnly: options.cookie?.httpOnly ?? true,
      secure: options.cookie?.secure ?? false,
      sameSite: options.cookie?.sameSite ?? "Lax",
      path: options.cookie?.path ?? "/",
    },
  };

  return async (request, next) => {
    const cookies = parseCookies(request.headers.cookie);
    const sessionIdFromCookie = cookies[config.name];

    const storage = new StorageClass(config.cookie.maxAge);
    await loadSessionFromCookie(storage, sessionIdFromCookie);

    const session = new Session(storage);
    request.setSession(session);

    const sessionIdBefore = storage.id();

    if (!sessionIdBefore && config.saveUninitialized) await storage.start();

    const response = await next(request);
    const sessionIdAfter = storage.id();

    if (sessionIdAfter && config.rolling) await storage.touch();

    const sessionWasCreated = !sessionIdBefore && Boolean(sessionIdAfter);
    const shouldSetCookie =
      Boolean(sessionIdAfter) &&
      (config.rolling || config.saveUninitialized || sessionWasCreated);

    if (shouldSetCookie && sessionIdAfter) {
      response.setHeader(
        "Set-Cookie",
        serializeCookie(config.name, sessionIdAfter, {
          maxAge: config.cookie.maxAge,
          path: config.cookie.path,
          httpOnly: config.cookie.httpOnly,
          secure: config.cookie.secure,
          sameSite: config.cookie.sameSite,
        }),
      );
    }

    return response;
  };
};
