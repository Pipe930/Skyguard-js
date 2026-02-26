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
export interface SessionMiddlewareOptions {
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
 * Fully-resolved session middleware configuration.
 *
 * This is the normalized configuration used internally by the middleware after
 * applying defaults and coercing optional values into a complete shape.
 *
 * Notes:
 * - `cookie` is `Required<CookieOptions>` to guarantee all attributes are present.
 * - `name` is the cookie name that stores the session id (e.g., "connect.sid").
 * - `rolling` refreshes the session TTL (and re-sets the cookie) on every request
 *   when a session exists.
 * - `saveUninitialized` creates a session (and sets a cookie) even if the user
 *   has not stored any data yet.
 */
interface ResolvedSessionOptions {
  /** Cookie name used to store the session id (default: "connect.sid"). */
  name: string;

  /**
   * When true, refreshes session expiration on every response (when a session exists).
   * This typically implies calling `touch()` and re-sending `Set-Cookie`.
   */
  rolling: boolean;

  /**
   * When true, creates a new session for requests without an existing session id,
   * even if no session data is written.
   */
  saveUninitialized: boolean;

  /**
   * Normalized cookie attributes used when serializing the `Set-Cookie` header.
   */
  cookie: Required<CookieOptions>;
}

/**
 * Normalizes raw middleware options by applying defaults and producing a fully
 * resolved configuration object.
 *
 * @param rawOptions - User-provided middleware options (possibly partial/undefined).
 * @returns A fully-resolved configuration suitable for internal use.
 */
function resolveOptions(
  rawOptions: SessionMiddlewareOptions = {},
): ResolvedSessionOptions {
  const maxAge = rawOptions.cookie?.maxAge ?? 86400;

  return {
    name: rawOptions.name ?? "connect.sid",
    rolling: rawOptions.rolling ?? false,
    saveUninitialized: rawOptions.saveUninitialized ?? false,
    cookie: {
      maxAge,
      httpOnly: rawOptions.cookie?.httpOnly ?? true,
      secure: rawOptions.cookie?.secure ?? false,
      sameSite: rawOptions.cookie?.sameSite ?? "Lax",
      path: rawOptions.cookie?.path ?? "/",
    },
  };
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
  options: SessionMiddlewareOptions = {},
): Middleware => {
  const config = resolveOptions(options);

  return async (request, next) => {
    const cookies = parseCookies(request.headers.cookie);
    const sessionIdFromCookie = cookies[config.name];

    const storage = new StorageClass(config.cookie.maxAge);
    await loadSessionFromCookie(storage, sessionIdFromCookie);

    const session = new Session(storage);
    request.setSession(session);

    const sessionIdBefore = storage.id();

    if (!sessionIdBefore && config.saveUninitialized) {
      await storage.start();
    }

    const response = await next(request);
    const sessionIdAfter = storage.id();

    if (sessionIdAfter && config.rolling) {
      await storage.touch();
    }

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
