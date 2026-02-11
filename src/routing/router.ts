import type { HashMapRouters, Middleware, RouteHandler } from "../types";
import { Request, Response, HttpMethods } from "../http";
import { HttpNotFoundException } from "../exceptions/httpNotFoundException";
import { Layer } from "./layer";
import { RouterGroup } from "./routerGroup";

/**
 * Central routing system of the framework.
 *
 * Registers routes by HTTP method, resolves the matching {@link Layer},
 * and executes the route handler with middleware support (onion model).
 *
 * @example
 * const router = new Router();
 *
 * router.setPrefix("/api");
 * router.middlewares([LoggerMiddleware]);
 *
 * router.get("/users/{id}", (req) => {
 *   const id = req.getParams("id");
 *   return Response.json({ id });
 * }, [AuthMiddleware]);
 */
export class Router {
  /** Routes organized by HTTP method */
  private routes: HashMapRouters = Object.create(null) as HashMapRouters;

  /** Global middlewares executed for every route */
  private globalMiddlewares: Middleware[] = [];

  /** Global prefix applied to all routes */
  private globalPrefix = "";

  /**
   * Creates a new router and initializes the internal route map.
   */
  constructor() {
    for (const method of Object.values(HttpMethods)) {
      this.routes[method] = [];
    }
  }

  /**
   * Finds the registered {@link Layer} that matches the request method and URL.
   *
   * @param request - Incoming framework request
   * @returns The matching {@link Layer}
   * @throws {HttpNotFoundException} If no route matches
   *
   * @example
   * // assuming: router.get("/users/{id}", handler)
   * const layer = router.resolveLayer(request);
   */
  public resolveLayer(request: Request): Layer {
    const routes = this.routes[request.getMethod];

    for (const route of routes) {
      if (route.matches(request.getUrl)) return route;
    }

    throw new HttpNotFoundException();
  }

  /**
   * Resolves and executes a request.
   *
   * Flow:
   * 1) Resolves the matching layer
   * 2) Attaches the layer to the request (enables path params)
   * 3) Runs global + route middlewares (if any)
   * 4) Executes the final route handler
   *
   * @param request - Request to process
   * @returns The handler/middleware response (sync or async)
   *
   * @example
   * const response = await router.resolve(request);
   */
  public resolve(request: Request): Promise<Response> | Response {
    const layer = this.resolveLayer(request);
    request.setLayer(layer);

    const action = layer.getAction;
    const allMiddlewares = [...this.globalMiddlewares, ...layer.getMiddlewares];

    if (allMiddlewares.length > 0) {
      return this.runMiddlewares(request, allMiddlewares, action);
    }

    return action(request);
  }

  /**
   * Runs a middleware chain using the onion model.
   *
   * Each middleware receives `(request, next)` and can run code
   * before/after calling `next()`.
   *
   * @param request - Incoming request
   * @param middlewares - Remaining middlewares to execute
   * @param target - Final route handler
   * @returns The response returned by a middleware or the final handler
   *
   * @internal
   */
  private runMiddlewares(
    request: Request,
    middlewares: Middleware[],
    target: RouteHandler,
  ): Response | Promise<Response> {
    if (middlewares.length === 0) return target(request);

    return middlewares[0](request, (request) =>
      this.runMiddlewares(request, middlewares.slice(1), target),
    );
  }

  /**
   * Registers a route and returns the created {@link Layer}.
   *
   * @param method - HTTP method
   * @param path - Route pattern (may include `{param}` segments)
   * @param action - Route handler
   * @param middlewares - Optional middlewares applied only to this route
   * @returns The created {@link Layer}
   *
   * @internal
   */
  private registerRoute(
    method: HttpMethods,
    path: string,
    action: RouteHandler,
    middlewares: Middleware[] = [],
  ): Layer {
    const fullPath = this.buildFullPath(path, this.globalPrefix);
    const layer = new Layer(fullPath, action);

    if (middlewares.length > 0) layer.setMiddlewares(middlewares);

    this.routes[method].push(layer);
    return layer;
  }

  /**
   * Sets a global prefix applied to all routes.
   *
   * @param prefix - Prefix to apply (e.g. "api", "/v1")
   * @returns The router instance (for chaining)
   *
   * @example
   * router.setPrefix("api");
   * router.get("/users", handler); // -> /api/users
   */
  public setPrefix(prefix: string): this {
    this.globalPrefix = prefix;
    return this;
  }

  /**
   * Builds a normalized path by applying a prefix.
   *
   * @param path - Route path
   * @param prefix - Prefix to apply
   * @returns Normalized full path
   */
  public buildFullPath(path: string, prefix: string): string {
    if (!prefix) return path;

    const cleanPrefix = prefix.startsWith("/") ? prefix : `/${prefix}`;
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    let fullPath = `${cleanPrefix}${cleanPath}`.replace(/\/+/g, "/");

    if (fullPath.length > 1 && fullPath.endsWith("/")) {
      fullPath = fullPath.slice(0, -1);
    }

    return fullPath;
  }

  /**
   * Creates a route group under a shared prefix.
   *
   * Use this to organize related routes and apply shared middlewares
   * without duplication.
   *
   * @param prefix - Base prefix for the group
   * @param callback - Function used to register group routes
   *
   * @example
   * router.group("/api", (api) => {
   *   api.use(AuthMiddleware);
   *   api.get("/users", listUsers);
   *   api.post("/users", createUser);
   * });
   */
  public group(prefix: string, callback: (group: RouterGroup) => void): void {
    const fullPrefix = this.globalPrefix
      ? `${this.globalPrefix}/${prefix}`.replace(/\/+/g, "/")
      : prefix;

    const group = new RouterGroup(fullPrefix, this);
    callback(group);
  }

  /**
   * Registers global middlewares executed for every route.
   *
   * @param middlewares - Middleware list
   * @returns The router instance (for chaining)
   *
   * @example
   * router.middlewares([LoggerMiddleware, CorsMiddleware]);
   */
  public middlewares(middlewares: Middleware[]): this {
    this.globalMiddlewares.push(...middlewares);
    return this;
  }

  /** Registers a GET route. */
  public get(
    path: string,
    action: RouteHandler,
    middlewares?: Middleware[],
  ): Layer {
    return this.registerRoute(HttpMethods.get, path, action, middlewares);
  }

  /** Registers a POST route. */
  public post(
    path: string,
    action: RouteHandler,
    middlewares?: Middleware[],
  ): Layer {
    return this.registerRoute(HttpMethods.post, path, action, middlewares);
  }

  /** Registers a PATCH route. */
  public patch(
    path: string,
    action: RouteHandler,
    middlewares?: Middleware[],
  ): Layer {
    return this.registerRoute(HttpMethods.patch, path, action, middlewares);
  }

  /** Registers a PUT route. */
  public put(
    path: string,
    action: RouteHandler,
    middlewares?: Middleware[],
  ): Layer {
    return this.registerRoute(HttpMethods.put, path, action, middlewares);
  }

  /** Registers a DELETE route. */
  public delete(
    path: string,
    action: RouteHandler,
    middlewares?: Middleware[],
  ): Layer {
    return this.registerRoute(HttpMethods.delete, path, action, middlewares);
  }
}
