import { HttpMethods } from "./httpMethods";
import { IncomingMessage, ServerResponse } from "node:http";
import { HttpAdapter } from "./httpAdapter";
import { Response } from "./response";
import { Request } from "./request";
import { ContentParserManager } from "../parsers/contentParserManager";
import { ContentParseError } from "../exceptions/contentParserException";

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
  private contentParser: ContentParserManager;

  /**
   * Crea una nueva instancia del adaptador HTTP para Node.js.
   *
   * @param req - Objeto de solicitud nativo de Node.js.
   * @param res - Objeto de respuesta nativo de Node.js.
   */
  constructor(
    private readonly req: IncomingMessage,
    private readonly res: ServerResponse,
  ) {
    this.contentParser = new ContentParserManager();
  }

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
  public async getRequest(): Promise<Request> {
    const url = new URL(this.req.url || "", `http://${this.req.headers.host}`);

    const request = new Request()
      .setUrl(url.pathname)
      .setMethod((this.req.method as HttpMethods) || HttpMethods.get)
      .setQueryParameters(Object.fromEntries(url.searchParams.entries()))
      .setHeaders(this.req.headers);

    const body = await this.readBody();
    if (body.length > 0) {
      const contentType = this.req.headers["content-type"] || "text/plain";
      const parsedData = await this.contentParser.parse(body, contentType);
      request.setData(parsedData);
    } else {
      request.setData({});
    }

    return request;
  }

  /**
   * Lee el body completo de la solicitud.
   */
  private readBody(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      this.req.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      this.req.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      this.req.on("error", (error) => {
        reject(
          new ContentParseError(
            "Failed to read request body",
            "READ_ERROR",
            error,
          ),
        );
      });
    });
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
