import { Response, Request, HttpMethods } from "../http/index";
import { Layer } from "../routing/layer";
import { IncomingHttpHeaders } from "node:http";

/**
 * Route controller function.
 *
 * Represents the final endpoint in the execution pipeline.
 * Receives a normalized {@link Request} and must return
 * a {@link Response}.
 *
 * @example
 * const handler: RouteHandler = (req) => {
 *   return Response.json({ message: "Hello world" });
 * };
 */
export type RouteHandler = (request: Request) => Promise<Response> | Response;

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
 * Typed representation of incoming HTTP headers.
 *
 * Direct alias of Node.js `IncomingHttpHeaders`,
 * used to decouple the framework domain from
 * the underlying runtime implementation.
 */
export type Headers = IncomingHttpHeaders;

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
 * @param request - Current {@link Request} instance
 * @param next - Function that executes the next middleware
 * or the route handler
 * @returns A {@link Response} or a Promise resolving to {@link Response}
 *
 * @example
 * const loggerMiddleware: Middleware = async (request, next) => {
 *   console.log(request.getMethod, request.getUrl);
 *
 *   const response = await next(request);
 *   return response;
 * };
 *
 * app.middlewares([loggerMiddleware]);
 */
export type Middleware = (
  request: Request,
  next: RouteHandler,
) => Response | Promise<Response>;
