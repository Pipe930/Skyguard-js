import { NextFunction } from "../utils/types";
import { Request } from "./request";
import { Response } from "./response";

/**
 * Un middleware es un componente intermedio dentro del pipeline de ejecución
 * de una solicitud HTTP. Su responsabilidad es interceptar la petición antes
 * (o después) del controlador final para aplicar lógica transversal como:
 *
 * Este patrón implementa el clásico **Chain of Responsibility**.
 *
 * @example Middleware de autenticación
 * class AuthMiddleware implements Middleware {
 *   handle(request: Request, next: NextFunction): Response {
 *     const token = request.getHeaders["authorization"];
 *
 *     if (!token) {
 *       return Response.text("Unauthorized").setStatus(401);
 *     }
 *
 *     return next(request);
 *   }
 * }
 *
 * @example Middleware de logging
 * class LoggerMiddleware implements Middleware {
 *   handle(request: Request, next: NextFunction): Response {
 *     console.log(`[${request.getMethod}] ${request.getUrl}`);
 *     return next(request);
 *   }
 * }
 */
export interface Middleware {
  /**
   * Punto de entrada del middleware.
   *
   * @param request - Instancia normalizada de la solicitud HTTP.
   * @param next - Función que delega la ejecución
   * al siguiente middleware o al controlador final.
   *
   * @returns Debe retornar siempre una instancia de Response.
   */
  handle(request: Request, next: NextFunction): Response;
}
