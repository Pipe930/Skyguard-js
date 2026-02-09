import {
  type SessionStorage,
  type CookieOptions,
  Session,
} from "../sessions/index";
import type { Middleware } from "../types";

/**
 * Tipo que representa un constructor de `SessionStorage`.
 *
 * Permite inyectar dinámicamente distintas implementaciones
 * de almacenamiento de sesiones (memory, file, redis, etc).
 */
type SessionStorageConstructor<T extends SessionStorage = SessionStorage> =
  new (...args: any[]) => T;

/**
 * Parsea el header `Cookie` y lo convierte en un objeto clave/valor.
 *
 * @param cookieHeader Valor del header `Cookie`.
 *
 * @returns Objeto con las cookies parseadas.
 *
 * @example
 * parseCookies("foo=bar; session_id=abc123");
 * // { foo: "bar", session_id: "abc123" }
 */
function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((cookie) => {
      const [key, ...value] = cookie.trim().split("=");
      return [key, decodeURIComponent(value.join("="))];
    }),
  );
}

/**
 * Construye el valor del header `Set-Cookie` para la sesión.
 *
 * @param sessionId Identificador de la sesión.
 * @param config Configuración completa de la cookie.
 *
 * @returns String listo para ser usado en `Set-Cookie`.
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
 * Middleware encargado de gestionar el ciclo de vida de la sesión.
 *
 * Responsabilidades:
 * - Leer la cookie de sesión desde el request
 * - Inicializar el storage correspondiente
 * - Cargar o crear la sesión
 * - Inyectar la sesión en el request
 * - Persistir la sesión en la response mediante cookies
 *
 * Este middleware es agnóstico al tipo de storage utilizado.
 *
 * @param StorageClass Clase que implementa `SessionStorage`.
 * @param options Opciones de configuración de la cookie de sesión.
 *
 * @returns Middleware de sesión.
 *
 * @example
 * app.use(
 *   sessionMiddleware(MemorySessionStorage, {
 *     cookieName: "sid",
 *     maxAge: 86400,
 *   })
 * );
 */
export function sessionMiddleware(
  StorageClass: SessionStorageConstructor,
  options: CookieOptions = {},
): Middleware {
  const timeMaxAge = 86400;
  const config: Required<CookieOptions> = {
    cookieName: options.cookieName || "session_id",
    maxAge: options.maxAge || timeMaxAge,
    httpOnly: options.httpOnly ?? true,
    secure: options.secure ?? false,
    sameSite: options.sameSite || "Lax",
    path: options.path || "/",
  };

  return async (request, next) => {
    const cookies = parseCookies(request.getHeaders["cookie"] || "");
    const sessionId = cookies[config.cookieName];

    const newStorage = new StorageClass(options.maxAge || timeMaxAge);

    if (sessionId) newStorage.load(sessionId);

    const session = new Session(newStorage);
    request.setSession(session);

    const response = await next(request);

    if (newStorage.id() !== null) {
      const cookieValue = buildSessionCookie(newStorage.id(), config);
      response.setHeader("Set-Cookie", cookieValue);
    }

    return response;
  };
}
