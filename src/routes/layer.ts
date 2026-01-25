import { Middleware } from "../http";
import { RouteHandler } from "../utils/types";
import { App } from "../app";

/**
 * Clase que representa una ruta individual en el sistema de enrutamiento
 *
 * Responsabilidades principales:
 * - Compilar patrones de URL con parámetros dinámicos a expresiones regulares
 * - Validar si una URL entrante coincide con el patrón definido
 * - Extraer parámetros dinámicos de URLs (ej: '/users/{id}' → { id: '42' })
 * - Gestionar middlewares asociados a la ruta
 *
 * @example
 * const layer = new Layer('/users/{id}', userController);
 * layer.matches('/users/42'); // true
 * layer.parseParameters('/users/42'); // { id: '42' }
 */
export class Layer {
  /**
   * Plantilla original de la URL con sintaxis de parámetros
   * @example '/users/{id}' o '/posts/{postId}/comments/{commentId}'
   */
  private url: string;

  /**
   * Expresión regular compilada desde la URL para hacer matching
   * @example '/users/{id}' se convierte en /^\/users\/([a-zA-Z0-9]+)\/?$/
   */
  private regex: RegExp;

  /**
   * Nombres de los parámetros extraídos de la URL en orden de aparición
   * @example Para '/users/{id}' → ['id']
   * @example Para '/posts/{postId}/comments/{commentId}' → ['postId', 'commentId']
   */
  private parameters: string[];

  /**
   * Handler/controlador que se ejecuta cuando la ruta hace match
   */
  private action: RouteHandler;

  /**
   * Middlewares que se ejecutan antes del handler principal
   */
  private middlewares: Middleware[] = [];

  /**
   * Construye una nueva capa de ruta
   *
   * Proceso interno:
   * 1. Busca parámetros en formato {param} en la URL
   * 2. Los reemplaza por grupos de captura regex: ([a-zA-Z0-9]+)
   * 3. Compila el patrón final con ^ y $ para match exacto
   *
   * @param url - Plantilla de la ruta (usa {nombreParam} para parámetros dinámicos)
   * @param action - Función handler que procesa las peticiones a esta ruta
   */
  constructor(url: string, action: RouteHandler) {
    const paramRegex = /\{([a-zA-Z]+)\}/g;
    const regexSource = url.replace(paramRegex, "([a-zA-Z0-9]+)");

    this.url = url;
    this.regex = new RegExp(`^${regexSource}/?$`); // El /? permite trailing slash opcional
    this.parameters = [...url.matchAll(paramRegex)].map((m) => m[1]);
    this.action = action;
  }

  get getUrl(): string {
    return this.url;
  }

  get getAction(): RouteHandler {
    return this.action;
  }

  get getMiddlewares(): Middleware[] {
    return this.middlewares;
  }

  /**
   * Asigna middlewares a esta ruta
   *
   * @param middlewares - Array de clases de middleware (no instancias)
   * @returns this - Para permitir method chaining
   *
   * @example
   * layer.setMiddlewares([AuthMiddleware, LoggerMiddleware])
   */
  public setMiddlewares(middlewares: Array<new () => Middleware>): this {
    this.middlewares = middlewares.map((middleware) => new middleware());
    return this;
  }

  /**
   * Verifica si la ruta tiene middlewares configurados
   */
  public hasMiddlewares(): boolean {
    return this.middlewares.length > 0;
  }

  /**
   * TODO: Documenta o elimina este método - parece ser para testing
   * Método estático que crea una ruta GET usando el router de la app
   */
  public static getTest(url: string, action: RouteHandler, app: App): Layer {
    return app.router.get(url, action);
  }

  /**
   * Verifica si una URL entrante coincide con el patrón de esta ruta
   *
   * @param url - URL de la petición HTTP
   * @returns true si la URL cumple con el patrón definido
   *
   * @example
   * const layer = new Layer('/users/{id}', handler);
   * layer.matches('/users/42');     // true
   * layer.matches('/users/42/');    // true (trailing slash opcional)
   * layer.matches('/users/abc');    // true
   * layer.matches('/posts/1');      // false
   */
  public matches(url: string): boolean {
    return this.regex.test(url);
  }

  /**
   * Indica si esta ruta tiene parámetros dinámicos
   */
  public hasParameters(): boolean {
    return this.parameters.length > 0;
  }

  /**
   * Extrae los valores de los parámetros dinámicos desde una URL real
   *
   * IMPORTANTE: Solo llamar después de verificar matches() === true
   *
   * @param url - URL real de la petición
   * @returns Objeto con pares clave-valor de los parámetros extraídos
   *
   * @example
   * const layer = new Layer('/users/{id}', handler);
   * layer.parseParameters('/users/42');
   * // Retorna: { id: '42' }
   *
   * @example
   * const layer = new Layer('/posts/{postId}/comments/{commentId}', handler);
   * layer.parseParameters('/posts/10/comments/5');
   * // Retorna: { postId: '10', commentId: '5' }
   */
  public parseParameters(url: string): Record<string, string> {
    const match = this.regex.exec(url);
    if (!match) return {};

    const params: Record<string, string> = {};

    this.parameters.forEach((name, index) => {
      params[name] = match[index + 1]; // index + 1 porque match[0] es el match completo
    });

    return params;
  }
}
