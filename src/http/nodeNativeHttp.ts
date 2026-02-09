import { HttpMethods } from "./httpMethods";
import { IncomingMessage, ServerResponse } from "node:http";
import type { HttpAdapter } from "./httpAdapter";
import { Response } from "./response";
import { Request } from "./request";
import { ContentParserManager } from "@parsers/contentParserManager";

/**
 * Esta clase actúa como un *bridge* entre la API nativa de Node.js
 * (`IncomingMessage` / `ServerResponse`) y las abstracciones internas
 * del framework (`Request` / `Response`).
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
   * @returns Instancia de {@link Request} completamente hidratada.
   */
  public async getRequest(): Promise<Request> {
    const url = new URL(this.req.url || "", `http://${this.req.headers.host}`);

    const request = new Request(url.pathname)
      .setMethod((this.req.method as HttpMethods) || HttpMethods.get)
      .setQueryParams(Object.fromEntries(url.searchParams.entries()))
      .setHeaders(this.req.headers);

    const parsedData = await this.contentParser.parse(this.req);
    request.setData(parsedData);

    return request;
  }

  /**
   * Envía la respuesta al cliente mapeando un objeto {@link Response}
   * del framework hacia el objeto {@link ServerResponse} nativo de Node.js.
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
