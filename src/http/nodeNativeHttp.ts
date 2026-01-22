import { HttpMethods } from "./httpMethods";
import { IncomingMessage, ServerResponse } from "node:http";
import { HttpAdapter } from "./httpAdapter";
import { Response } from "./response";
import { Request } from "./request";

/**
 * Esta clase actúa como un *bridge* entre la API nativa de Node.js
 * (`IncomingMessage` / `ServerResponse`) y las abstracciones internas
 * del framework (`Request` / `Response`).
 *
 * Su responsabilidad es:
 * - Extraer y normalizar los datos de la petición entrante.
 * - Construir una instancia de {@link Request} del framework.
 * - Mapear una {@link Response} del framework hacia la respuesta nativa de Node.
 *
 * Esta clase **no contiene lógica de negocio**, routing ni middlewares.
 * Forma parte exclusivamente de la capa de infraestructura.
 * @implements {HttpAdapter}
 */
export class NodeHttpAdapter implements HttpAdapter {
  /**
   * Crea una nueva instancia del adaptador HTTP para Node.js.
   *
   * @param req - Objeto de solicitud nativo de Node.js.
   * @param res - Objeto de respuesta nativo de Node.js.
   */
  constructor(
    private readonly req: IncomingMessage,
    private readonly res: ServerResponse,
  ) {}

  /**
   * Construye y retorna un objeto {@link Request} del framework
   * a partir de los datos contenidos en `IncomingMessage`.
   *
   * Este método se encarga de:
   * - Parsear la URL.
   * - Extraer el método HTTP.
   * - Mapear los query parameters.
   * - Copiar los headers.
   *
   * @returns Instancia de {@link Request} completamente hidratada.
   */
  public getRequest(): Request {
    const url = new URL(this.req.url || "", `http://${this.req.headers.host}`);

    return new Request()
      .setUrl(url.pathname)
      .setMethod((this.req.method as HttpMethods) || HttpMethods.get)
      .setQueryParameters(Object.fromEntries(url.searchParams.entries()))
      .setHeaders(this.req.headers)
      .setData({});
  }

  /**
   * Envía la respuesta al cliente mapeando un objeto {@link Response}
   * del framework hacia el objeto {@link ServerResponse} nativo de Node.js.
   *
   * Este método se encarga de:
   * - Preparar la respuesta (serialización, headers, etc).
   * - Establecer el código de estado HTTP.
   * - Escribir los headers.
   * - Finalizar la respuesta.
   *
   * @param response - Objeto de respuesta del framework.
   */
  public sendResponse(response: Response): void {
    response.prepare();
    this.res.statusCode = response.getStatus;

    const headers = response.getHeaders;
    for (const [header, value] of Object.entries(headers)) {
      this.res.setHeader(header, value as string);
    }

    if (!response.getContent) this.res.removeHeader("Content-Type");

    this.res.end(response.getContent);
  }
}
