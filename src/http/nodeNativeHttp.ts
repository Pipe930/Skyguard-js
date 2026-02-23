import { HttpMethods } from "./httpMethods";
import { IncomingMessage, ServerResponse } from "node:http";
import type { HttpAdapter } from "./httpAdapter";
import { Response } from "./response";
import { Request } from "./request";
import { ContentParserManager } from "../parsers/contentParserManager";
import { Logger } from "./logger";

/**
 * Node.js HTTP adapter.
 *
 * Acts as a bridge between the native Node.js HTTP API and the
 * internal framework abstractions.
 *
 * @implements {HttpAdapter}
 */
export class NodeHttpAdapter implements HttpAdapter {
  private contentParser: ContentParserManager;

  /**
   * @param req - Native Node.js incoming request
   * @param res - Native Node.js server response
   */
  constructor(
    private readonly req: IncomingMessage,
    private readonly res: ServerResponse,
  ) {
    this.contentParser = new ContentParserManager();
  }

  /**
   * Builds and returns a {@link Request} instance from
   * the incoming Node.js request.
   *
   * @returns A fully constructed {@link Request} instance
   */
  public async getRequest(): Promise<Request> {
    const url = new URL(this.req.url || "", `http://${this.req.headers.host}`);

    const request = new Request(url.pathname)
      .setMethod((this.req.method as HttpMethods) || HttpMethods.get)
      .setQuery(Object.fromEntries(url.searchParams.entries()))
      .setHeaders(this.req.headers);

    if (
      request.method === HttpMethods.post ||
      request.method === HttpMethods.put ||
      request.method === HttpMethods.patch
    ) {
      const parsedData = await this.contentParser.parse(this.req);
      request.setData(parsedData);
    }

    return request;
  }

  /**
   * Sends a framework {@link Response} to the client by mapping it
   * to the native Node.js {@link ServerResponse}.
   *
   * This method represents the final step of the request lifecycle
   * in a Node.js runtime.
   *
   * @param response - Framework response to be sent to the client
   */
  public sendResponse(response: Response): void {
    response.prepare();
    this.res.statusCode = response.statusCode;
    const headers = response.headers;

    for (const [header, value] of Object.entries(headers)) {
      this.res.setHeader(header, value as string);
    }

    if (!response.content) this.res.removeHeader("Content-Type");

    this.res.end(response.content);
  }
}
