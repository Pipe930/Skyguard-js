import { Request } from "./request";
import { Response } from "./response";

/**
 * Contrato de alto nivel que define el *puerto de entrada* del framework
 * hacia el mundo exterior (HTTP, sockets, runtimes, etc).
 *
 * Interfaz que permite desacoplar completamente el núcleo del framework
 * de cualquier implementación concreta de servidor (Node.js, Bun, Deno, Cloudflare, etc).
 *
 * Un HttpAdapter es responsable exclusivamente de:
 * - Traducir una petición entrante del entorno de ejecución a un {@link Request}.
 * - Traducir una {@link Response} del framework a una respuesta real del entorno.
 *
 * No debe contener lógica de negocio, routing, middlewares ni validaciones.
 * Su rol es puramente de infraestructura.
 */
export interface HttpAdapter {
  /**
   * Construye y retorna una instancia de {@link Request} del framework
   * a partir de la información de la conexión actual.
   *
   * Este método debe encargarse de:
   * - Normalizar la URL.
   * - Resolver el método HTTP.
   * - Mapear los headers.
   * - Parsear el cuerpo de la petición (body), si existe.
   *
   * @returns Una promesa que resuelve en un objeto {@link Request}
   * listo para ser procesado por el kernel.
   */
  getRequest(): Promise<Request>;

  /**
   * Envía al cliente una {@link Response} generada por el framework,
   * mapeando su estado, cabeceras y contenido al protocolo subyacente
   * del entorno de ejecución.
   *
   * Este método representa el *punto final* del ciclo de vida
   * de una petición HTTP dentro del framework.
   *
   * @param response - Objeto {@link Response} que contiene
   * la información de salida definida por la aplicación.
   */
  sendResponse(response: Response): void;
}
