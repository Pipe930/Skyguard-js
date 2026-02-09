/**
 * Opciones de configuración para cookies de sesión.
 *
 * Esta interfaz define los atributos que controlan
 * el comportamiento y la seguridad de la cookie enviada
 * al cliente.
 *
 * Todas las opciones son opcionales. Si no se proveen,
 * el framework aplicará valores por defecto seguros.
 *
 * @example
 * const options: CookieOptions = {
 *   cookieName: "session_id",
 *   maxAge: 60 * 60 * 24, // 1 día
 *   httpOnly: true,
 *   secure: true,
 *   sameSite: "Lax",
 *   path: "/",
 * };
 */
export interface CookieOptions {
  /**
   * Nombre de la cookie.
   *
   * Se utiliza para identificar la cookie de sesión
   * en el cliente.
   *
   * @default "session_id"
   */
  cookieName?: string;

  /**
   * Tiempo de vida de la cookie en segundos.
   *
   * Indica cuánto tiempo el navegador debe conservar
   * la cookie antes de eliminarla automáticamente.
   *
   * @default 86400 (1 día)
   */
  maxAge?: number;

  /**
   * Indica si la cookie debe ser inaccesible desde JavaScript.
   *
   * Cuando está habilitado, la cookie no puede ser leída
   * mediante `document.cookie`, lo que ayuda a mitigar
   * ataques XSS.
   *
   * @default true
   */
  httpOnly?: boolean;

  /**
   * Indica si la cookie solo debe enviarse sobre HTTPS.
   *
   * Debe habilitarse en producción cuando se usa HTTPS
   * para prevenir la exposición de la cookie en conexiones
   * no seguras.
   *
   * @default false
   */
  secure?: boolean;

  /**
   * Controla cuándo el navegador envía la cookie
   * en requests cross-site.
   *
   * - "Strict": solo se envía en requests same-site.
   * - "Lax": se envía en navegación de primer nivel (default recomendado).
   * - "None": se envía siempre (requiere `secure: true`).
   *
   * @default "Lax"
   */
  sameSite?: "Strict" | "Lax" | "None";

  /**
   * Ruta para la cual la cookie es válida.
   *
   * La cookie solo será enviada por el navegador
   * en requests cuya URL coincida con esta ruta.
   *
   * @default "/"
   */
  path?: string;
}
