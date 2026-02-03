import { HashMapRouters, RouteHandler } from "../types";
import { Request, Response, HttpMethods, Middleware } from "../http";
import { HttpNotFoundException } from "../exceptions";
import { Layer } from "./layer";

/**
 * Clase que representa el sistema central de enrutamiento del framework
 *
 * @example
 * const router = new Router();
 * router.get('/users/{id}', (req) => new Response({ userId: req.params.id }))
 *       .setMiddlewares([AuthMiddleware]);
 */
export class Router {
  /**
   * Mapa de rutas organizadas por método HTTP
   * Estructura: { 'GET': [Layer, Layer], 'POST': [Layer], ... }
   */
  private routes: HashMapRouters = Object.create(null) as HashMapRouters;

  /**
   * Inicializa el router creando arrays vacíos para cada método HTTP
   *
   * Prepara la estructura: { GET: [], POST: [], PUT: [], PATCH: [], DELETE: [] }
   * Esto permite agregar rutas sin verificar si el array existe
   */
  constructor() {
    for (const method of Object.values(HttpMethods)) {
      this.routes[method] = [];
    }
  }

  /**
   * Busca el Layer o ruta registrada que coincide con la URL y método de la petición
   *
   * @param request - Objeto de petición HTTP entrante
   * @returns Devuelve una clase Layer que coincide con la ruta
   * @throws HttpNotFoundException - Si ninguna ruta coincide
   *
   * @example
   * // Asumiendo router.get('/users/{id}', handler)
   * const request = new Request('GET', '/users/42');
   * const layer = router.resolveLayer(request); // Retorna el Layer de /users/{id}
   */
  public resolveLayer(request: Request): Layer {
    const routes = this.routes[request.getMethod];

    for (const route of routes) {
      if (route.matches(request.getUrl)) {
        return route;
      }
    }

    throw new HttpNotFoundException();
  }

  /**
   * Resuelve y ejecuta completamente una petición HTTP
   *
   * Flujo completo:
   * 1. Encuentra el Layer correspondiente (resolveLayer)
   * 2. Inyecta el Layer en la Request para acceso a parámetros
   * 3. Si hay middlewares, los ejecuta en cadena
   * 4. Finalmente ejecuta el handler/action principal
   *
   * @param request - Petición HTTP a procesar
   * @returns Devuelve un response del handler o middleware
   *
   * @example
   * const request = new Request('POST', '/users');
   * const response = router.resolve(request);
   */
  public resolve(request: Request): Promise<Response> | Response {
    const layer = this.resolveLayer(request);
    request.setLayer(layer);
    const action = layer.getAction;

    if (layer.hasMiddlewares())
      return this.runMiddlewares(request, layer.getMiddlewares, action);

    return action(request);
  }

  /**
   * Ejecuta la cadena de middlewares de forma recursiva
   *
   * Patrón de ejecución:
   * - Cada middleware recibe el request y una función "next"
   * - "next" ejecuta el siguiente middleware en la cadena
   * - Cuando no quedan middlewares, ejecuta el handler final (target)
   *
   * NOTA: Implementa el patrón "onion model" (modelo cebolla) donde cada
   * middleware puede ejecutar código antes y después de llamar a next()
   *
   * @param request - Petición HTTP
   * @param middlewares - Array de middlewares restantes por ejecutar
   * @param target - Handler final a ejecutar después de todos los middlewares
   * @returns Devuelve un response del handler o de algún middleware que corte la cadena
   *
   * @example
   * Cadena: [AuthMiddleware, LoggerMiddleware] → handler
   * Ejecución:
   * 1. AuthMiddleware.handle(req, next)
   * 2.   LoggerMiddleware.handle(req, next)
   * 3.     handler(req)
   */
  private runMiddlewares(
    request: Request,
    middlewares: Middleware[],
    target: RouteHandler,
  ): Response | Promise<Response> {
    if (middlewares.length === 0) return target(request);

    return middlewares[0].handle(request, (request) =>
      this.runMiddlewares(request, middlewares.slice(1), target),
    );
  }

  /**
   * Método interno para registrar una ruta en el router
   *
   * @param method - Método HTTP (GET, POST, etc.)
   * @param path - Patrón de la URL (puede incluir parámetros: '/users/{id}')
   * @param action - Handler que procesa la petición
   * @returns Devuelve la instancia de la clase Lyaer creado (permite encadenar .setMiddlewares())
   */
  private registerRoute(
    method: HttpMethods,
    path: string,
    action: RouteHandler,
  ): Layer {
    const layer = new Layer(path, action);
    this.routes[method].push(layer);
    return layer;
  }

  /**
   * Registra una ruta GET
   *
   * @example
   * router.get('/users', listUsers);
   * router.get('/users/{id}', getUser).setMiddlewares([AuthMiddleware]);
   */
  public get(path: string, action: RouteHandler): Layer {
    return this.registerRoute(HttpMethods.get, path, action);
  }

  /**
   * Registra una ruta POST
   *
   * @example
   * router.post('/users', createUser);
   */
  public post(path: string, action: RouteHandler): Layer {
    return this.registerRoute(HttpMethods.post, path, action);
  }

  /**
   * Registra una ruta PATCH
   *
   * @example
   * router.patch('/users/{id}', updateUserPartial);
   */
  public patch(path: string, action: RouteHandler): Layer {
    return this.registerRoute(HttpMethods.patch, path, action);
  }

  /**
   * Registra una ruta PUT
   *
   * @example
   * router.put('/users/{id}', updateUserFull);
   */
  public put(path: string, action: RouteHandler): Layer {
    return this.registerRoute(HttpMethods.put, path, action);
  }

  /**
   * Registra una ruta DELETE
   *
   * @example
   * router.delete('/users/{id}', deleteUser);
   */
  public delete(path: string, action: RouteHandler): Layer {
    return this.registerRoute(HttpMethods.delete, path, action);
  }
}
