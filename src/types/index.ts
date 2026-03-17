import { Response, Context, HttpMethods } from "../http/index";
import { Layer } from "../routing/layer";

/**
 * Route controller function.
 *
 * Represents the final endpoint in the execution pipeline.
 * Receives a normalized {@link Context} and must return
 * a {@link Response}.
 *
 * @example
 * const handler: RouteHandler = context => {
 *   return context.json({ message: "Hello world" });
 * };
 */
export type RouteHandler = (context: Context) => Promise<Response> | Response;

/**
 * Internal routing table structure.
 *
 * Map indexed by HTTP method where each key contains
 * an ordered list of {@link Layer} instances.
 *
 * Resulting shape:
 *
 * {
 *   GET:   [Layer, Layer, ...],
 *   POST:  [Layer],
 *   PUT:   [],
 *   ...
 * }
 *
 * Defined as {@link Partial} because not all HTTP methods
 * must be present.
 */
export type HashMapRouters = Partial<Record<HttpMethods, Layer[]>>;

/**
 * Helper function type for template engines.
 *
 * Represents a utility function callable from
 * within a template to transform data.
 *
 * @example
 * engine.registerHelper("upper", (value) =>
 *   String(value).toUpperCase()
 * );
 *
 * // Template usage:
 * // {{ upper name }}
 */
export type HelperFunction = (...args: unknown[]) => string;

/**
 * Data context passed to a view.
 *
 * Key-value map representing the ViewModel
 * consumed by the template engine.
 *
 * Acts as a generic abstraction of the model
 * in the MVC pattern.
 */
export type TemplateContext = Record<string, unknown>;

/**
 * Generic constructor type.
 *
 * Represents any instantiable class
 * using the `new` operator.
 *
 * Commonly used in:
 * - Dependency containers
 * - Factories
 * - IoC / Service Locator patterns
 *
 * @example
 * function resolve<T>(ctor: Constructor<T>): T {
 *   return new ctor();
 * }
 */
export type Constructor<T = unknown> = new (...args: unknown[]) => T;

/**
 * Framework middleware function.
 *
 * A middleware intercepts the HTTP request lifecycle
 * before and after it reaches the final route handler.
 *
 * Can be synchronous or asynchronous.
 *
 * @param context - Current {@link Context} instance
 * @param next - Function that executes the next middleware
 * or the route handler
 * @returns A {@link Response} or a Promise resolving to {@link Response}
 *
 * @example
 * const loggerMiddleware: Middleware = async (context, next) => {
 *   console.log(context.req.method, context.req.url);
 *
 *   const response = await next(context);
 *   return response;
 * };
 *
 * app.middlewares(loggerMiddleware);
 */
export type Middleware = (
  context: Context,
  next: RouteHandler,
) => Response | Promise<Response>;

export type HandlerOrMiddlewares = RouteHandler | Middleware[];
