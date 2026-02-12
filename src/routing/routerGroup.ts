import type { Middleware, RouteHandler } from "../types";
import { buildFullPath } from "./buildFullPath";
import { Router } from "./router";

type Methods = "get" | "post" | "put" | "patch" | "delete";

/**
 * Route group helper.
 *
 * Allows registering routes under a shared prefix and shared middlewares.
 * Similar to `express.Router()` or Laravel `Route::group()`, but routes are
 * fully resolved at registration time.
 *
 * @example
 * router.group("/api", (api) => {
 *   api.middlewares([AuthMiddleware]);
 *
 *   api.get("/users", listUsers);
 *   api.post("/users", createUser, [AdminMiddleware]);
 * });
 */
export class RouterGroup {
  /**
   * Base prefix applied to all group routes.
   *
   * @example
   * prefix = "/api"
   * path   = "/users"
   * result = "/api/users"
   */
  private prefix = "";

  /**
   * Middlewares applied to every route in this group.
   */
  private middlewaresGroup: Middleware[] = [];

  /**
   * Parent router where routes are actually registered.
   */
  private parentRouter: Router;

  /**
   * Creates a new route group.
   *
   * @param prefix - Base prefix for all group routes
   * @param parentRouter - Router instance used to register routes
   */
  constructor(prefix: string, parentRouter: Router) {
    this.prefix = prefix;
    this.parentRouter = parentRouter;
  }

  /**
   * Registers middlewares that run for all routes in this group.
   *
   * @param middlewares - Middleware list
   * @returns The group instance (for chaining)
   *
   * @example
   * group.middlewares([AuthMiddleware, AdminMiddleware]);
   */
  public middlewares(middlewares: Middleware[]): this {
    this.middlewaresGroup.push(...middlewares);
    return this;
  }

  /**
   * Registers a route in the parent router, combining:
   * - group prefix
   * - route path
   * - group middlewares + route middlewares
   *
   * @param method - Parent router method name (`get`, `post`, ...)
   * @param path - Route path relative to the group prefix
   * @param action - Final route handler
   * @param middlewares - Route-specific middlewares
   * @returns The created {@link Layer}
   *
   * @internal
   */
  private addRoute(
    method: keyof Pick<Router, Methods>,
    path: string,
    action: RouteHandler,
    middlewares: Middleware[] = [],
  ): void {
    const fullPath = buildFullPath(path, this.prefix);
    const totalMiddlewares = [...this.middlewaresGroup, ...middlewares];
    const layer = this.parentRouter[method](fullPath, action);

    if (totalMiddlewares.length > 0) layer.setMiddlewares(totalMiddlewares);
  }

  /** Registers a GET route within the group. */
  public get(
    path: string,
    action: RouteHandler,
    middlewares?: Middleware[],
  ): void {
    this.addRoute("get", path, action, middlewares);
  }

  /** Registers a POST route within the group. */
  public post(
    path: string,
    action: RouteHandler,
    middlewares?: Middleware[],
  ): void {
    this.addRoute("post", path, action, middlewares);
  }

  /** Registers a PUT route within the group. */
  public put(
    path: string,
    action: RouteHandler,
    middlewares?: Middleware[],
  ): void {
    this.addRoute("put", path, action, middlewares);
  }

  /** Registers a PATCH route within the group. */
  public patch(
    path: string,
    action: RouteHandler,
    middlewares?: Middleware[],
  ): void {
    this.addRoute("patch", path, action, middlewares);
  }

  /** Registers a DELETE route within the group. */
  public delete(
    path: string,
    action: RouteHandler,
    middlewares?: Middleware[],
  ): void {
    this.addRoute("delete", path, action, middlewares);
  }
}
