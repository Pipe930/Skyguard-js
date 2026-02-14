import type { Middleware, RouteHandler } from "../types";

/**
 * Represents a single route layer in the routing system.
 *
 * A layer compiles a route template (e.g. `/users/{id}`) into a regex,
 * can match incoming URLs, and can extract path parameters.
 *
 * @example
 * const layer = new Layer("/users/{id}", userController);
 * layer.matches("/users/42"); // true
 * layer.parseParameters("/users/42"); // { id: "42" }
 */
export class Layer {
  /** Original route template using `{param}` syntax. */
  private url: string;

  /** Compiled regex used to match incoming URLs. */
  private regex: RegExp;

  /** Parameter names extracted from the template in appearance order. */
  private parameters: string[];

  /** Handler executed when this layer matches. */
  private action: RouteHandler;

  /** Middlewares executed before the route handler. */
  private middlewares: Middleware[] = [];

  /**
   * Creates a new route layer.
   *
   * Internally it:
   * 1) Finds `{param}` segments in the template
   * 2) Replaces them with regex capture groups
   * 3) Compiles a final pattern for exact matching (optional trailing slash)
   *
   * @param url - Route template (use `{paramName}` for dynamic segments)
   * @param action - Handler function for this route
   */
  constructor(url: string, action: RouteHandler) {
    const paramRegex = /\{([a-zA-Z]+)\}/g;
    const regexSource = url.replace(paramRegex, "([a-zA-Z0-9]+)");

    this.url = url;
    this.regex = new RegExp(`^${regexSource}/?$`);
    this.parameters = [...url.matchAll(paramRegex)].map(m => m[1]);
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
   * Assigns middlewares to this route.
   *
   * @param middlewares - Middleware list executed before the handler
   * @returns The current {@link Layer} instance (for chaining)
   *
   * @example
   * layer.setMiddlewares([AuthMiddleware, LoggerMiddleware]);
   */
  public setMiddlewares(middlewares: Middleware[]): this {
    this.middlewares = middlewares;
    return this;
  }

  /**
   * Checks whether an incoming URL matches this route pattern.
   *
   * @param url - Incoming request URL (path only)
   * @returns `true` if the URL matches this layer
   *
   * @example
   * const layer = new Layer("/users/{id}", handler);
   * layer.matches("/users/42");   // true
   * layer.matches("/users/42/");  // true (optional trailing slash)
   * layer.matches("/posts/1");    // false
   */
  public matches(url: string): boolean {
    return this.regex.test(url);
  }

  /**
   * Indicates whether this route defines dynamic path parameters.
   *
   * @returns `true` if the route template includes `{param}` segments
   */
  public hasParameters(): boolean {
    return this.parameters.length > 0;
  }

  /**
   * Extracts path parameters from a concrete URL.
   *
   * Call this only after {@link Layer.matches} returns `true`.
   *
   * @param url - Incoming request URL (path only)
   * @returns Extracted parameters mapped by name
   *
   * @example
   * const layer = new Layer("/users/{id}", handler);
   * layer.parseParameters("/users/42"); // { id: "42" }
   *
   * const layer = new Layer("/posts/{postId}/comments/{commentId}", handler);
   * layer.parseParameters("/posts/10/comments/5");
   * // { postId: "10", commentId: "5" }
   */
  public parseParameters(url: string): Record<string, string> {
    const match = this.regex.exec(url);
    if (!match) return {};

    const params: Record<string, string> = {};

    this.parameters.forEach((name, index) => {
      params[name] = match[index + 1];
    });

    return params;
  }
}
