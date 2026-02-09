import type { Middleware, RouteHandler } from "../types";
import { Router } from "./router";
import { Layer } from "./layer";

type Methods = "get" | "post" | "put" | "patch" | "delete";

/**
 * RouterGroup permite agrupar rutas bajo un prefijo común y middlewares compartidos.
 *
 * Esta clase **no resuelve requests** ni mantiene estado de ejecución.
 * Su única responsabilidad es **componer rutas** (path + middlewares)
 * y delegar el registro final al `Router` padre.
 *
 * El comportamiento es similar a `express.Router()` o `Route::group()` de Laravel,
 * pero las rutas quedan completamente resueltas al momento de ser registradas.
 */
export class RouterGroup {
  /**
   * Prefijo base que se aplicará a todas las rutas del grupo.
   *
   * Ejemplo:
   * prefix = "/api"
   * path   = "/users"
   * result = "/api/users"
   */
  private prefix = "";

  /**
   * Middlewares que se aplican a **todas las rutas** del grupo.
   *
   * Se almacenan como clases (constructores),
   * las instancias se crean posteriormente dentro de `Layer`.
   */
  private middlewaresGroup: Middleware[] = [];

  /**
   * Router principal encargado de registrar y resolver las rutas.
   *
   * RouterGroup delega en esta instancia la creación real de los `Layer`.
   */
  private parentRouter: Router;

  /**
   * Crea un nuevo grupo de rutas.
   *
   * @param prefix Prefijo base para todas las rutas del grupo
   * @param parentRouter Router principal donde se registrarán las rutas
   */
  constructor(prefix: string, parentRouter: Router) {
    this.prefix = prefix;
    this.parentRouter = parentRouter;
  }

  /**
   * Registra middlewares que se ejecutarán en todas las rutas de este grupo
   *
   * @param middlewares - Array de constructores de middleware
   * @returns this para encadenamiento
   *
   * @example
   * group.middlewares([AuthMiddleware, AdminMiddleware]);
   */
  public middlewares(middlewares: Middleware[]): this {
    this.middlewaresGroup.push(...middlewares);
    return this;
  }

  /**
   * Registra una ruta en el Router padre,
   * combinando el prefijo del grupo, el path de la ruta
   * y todos los middlewares correspondientes.
   *
   * @param method Método HTTP a registrar
   * @param path Path relativo dentro del grupo
   * @param action Handler final de la ruta
   * @param middlewares Middlewares específicos de la ruta
   * @returns Layer creado en el Router padre
   *
   * @private
   */
  private addRoute(
    method: keyof Pick<Router, Methods>,
    path: string,
    action: RouteHandler,
    middlewares: Middleware[] = [],
  ): Layer {
    const fullPath = this.parentRouter.buildFullPath(path, this.prefix);
    const totalMiddlewares = [...this.middlewaresGroup, ...middlewares];
    const layer = this.parentRouter[method](fullPath, action);

    if (totalMiddlewares.length > 0) layer.setMiddlewares(totalMiddlewares);

    return layer;
  }

  /**
   * Registra una ruta GET dentro del grupo.
   *
   * @param path Path relativo
   * @param action Handler de la ruta
   * @param middlewares Middlewares específicos de la ruta
   * @returns Layer registrado
   */
  public get(
    path: string,
    action: RouteHandler,
    middlewares?: Middleware[],
  ): Layer {
    return this.addRoute("get", path, action, middlewares);
  }

  /**
   * Registra una ruta POST dentro del grupo.
   */
  public post(
    path: string,
    action: RouteHandler,
    middlewares?: Middleware[],
  ): Layer {
    return this.addRoute("post", path, action, middlewares);
  }

  /**
   * Registra una ruta PUT dentro del grupo.
   */
  public put(
    path: string,
    action: RouteHandler,
    middlewares?: Middleware[],
  ): Layer {
    return this.addRoute("put", path, action, middlewares);
  }

  /**
   * Registra una ruta PATCH dentro del grupo.
   */
  public patch(
    path: string,
    action: RouteHandler,
    middlewares?: Middleware[],
  ): Layer {
    return this.addRoute("patch", path, action, middlewares);
  }

  /**
   * Registra una ruta DELETE dentro del grupo.
   */
  public delete(
    path: string,
    action: RouteHandler,
    middlewares?: Middleware[],
  ): Layer {
    return this.addRoute("delete", path, action, middlewares);
  }
}
