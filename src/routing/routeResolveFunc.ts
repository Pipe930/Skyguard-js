import type { HandlerOrMiddlewares, RouteHandler, Middleware } from "../types";

/**
 * Normalizes route registration args to support both signatures:
 * - (path, action, middlewares?)
 * - (path, middlewares, action)
 */
export const normalizeRouteArgs = (
  handlerOrMiddlewares: HandlerOrMiddlewares,
  handler?: RouteHandler,
): { action: RouteHandler; middlewares: Middleware[] } => {
  if (Array.isArray(handlerOrMiddlewares)) {
    return {
      action: handler,
      middlewares: handlerOrMiddlewares,
    };
  }

  return {
    action: handlerOrMiddlewares,
    middlewares: Array.isArray(handler) ? handler : [],
  };
};
