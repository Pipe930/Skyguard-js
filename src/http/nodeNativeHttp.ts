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
  private logger: Logger;
  private readonly startTime: bigint;

  /**
   * @param req - Native Node.js incoming request
   * @param res - Native Node.js server response
   */
  constructor(
    private readonly req: IncomingMessage,
    private readonly res: ServerResponse,
  ) {
    this.startTime = process.hrtime.bigint();
    this.contentParser = new ContentParserManager();
    this.logger = new Logger();
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
      .setQueryParams(Object.fromEntries(url.searchParams.entries()))
      .setHeaders(this.req.headers);

    const parsedData = await this.contentParser.parse(this.req);
    request.setData(parsedData);

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
    this.res.statusCode = response.getStatus;

    const headers = response.getHeaders;
    for (const [header, value] of Object.entries(headers)) {
      this.res.setHeader(header, value as string);
    }

    if (!response.getContent) this.res.removeHeader("Content-Type");

    setImmediate(() => {
      this.logger.log(this.req, response, this.startTime);
    });

    this.res.end(response.getContent);
  }
}
