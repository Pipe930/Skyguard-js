import { type CookieOptions, Session, type SessionStorage } from "../sessions";
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

interface ResolvedSessionOptions {
  name: string;
  rolling: boolean;
  saveUninitialized: boolean;
  cookie: Required<CookieOptions>;
}

/**
 * Parses a Cookie header into a key/value map.
 */
function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};

  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map(cookie => cookie.trim())
      .filter(Boolean)
      .map(cookie => {
        const [rawKey, ...rawValue] = cookie.split("=");
        return [rawKey, decodeURIComponent(rawValue.join("="))];
      }),
  );
}

/**
 * Builds a Set-Cookie value for the session id.
 */
function buildSessionCookie(
  sessionId: string,
  options: ResolvedSessionOptions,
): string {
  const { cookie, name } = options;
  const parts: string[] = [
    `${name}=${encodeURIComponent(sessionId)}`,
    `Max-Age=${cookie.maxAge}`,
    `Path=${cookie.path}`,
    `SameSite=${cookie.sameSite}`,
  ];

  if (cookie.httpOnly) parts.push("HttpOnly");
  if (cookie.secure) parts.push("Secure");

  return parts.join("; ");
}

function isLegacyCookieOptions(
  options: SessionMiddlewareOptions | CookieOptions,
): options is CookieOptions {
  return "cookieName" in options || "maxAge" in options;
}

function resolveOptions(
  rawOptions: SessionMiddlewareOptions | CookieOptions = {},
): ResolvedSessionOptions {
  const options = isLegacyCookieOptions(rawOptions)
    ? { name: rawOptions.cookieName, cookie: rawOptions }
    : rawOptions;

  const maxAge = options.cookie?.maxAge ?? 86400;

  return {
    name: options.name ?? "connect.sid",
    rolling: options.rolling ?? false,
    saveUninitialized: options.saveUninitialized ?? false,
    cookie: {
      cookieName: options.name ?? "connect.sid",
      maxAge,
      httpOnly: options.cookie?.httpOnly ?? true,
      secure: options.cookie?.secure ?? false,
      sameSite: options.cookie?.sameSite ?? "Lax",
      path: options.cookie?.path ?? "/",
    },
  };
}

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
 * API inspired by express-session, adapted to Skyguard architecture.
 */
export const sessions = (
  StorageClass: SessionStorageConstructor,
  options: SessionMiddlewareOptions | CookieOptions = {},
): Middleware => {
  const config = resolveOptions(options);

  return async (request, next) => {
    const cookies = parseCookies(request.headers.cookie ?? "");
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
      response.setHeader("Set-Cookie", buildSessionCookie(sessionIdAfter, config));
    }

    return response;
  };
};
