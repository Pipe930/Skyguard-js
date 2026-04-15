import { HttpMethods } from "./httpMethods";
import { IncomingMessage, ServerResponse } from "node:http";
import type { HttpAdapter } from "./httpAdapter";
import { Response } from "./response";
import { Request } from "./request";
import { Context } from "./context";
import { ContentParserManager } from "../parsers/contentParserManager";
import { type LoggerOptions, Logger } from "./logger";
import { Readable } from "node:stream";
import { TLSSocket } from "node:tls";

/**
 * Node.js HTTP adapter.
 *
 * Acts as a bridge between the native Node.js HTTP API and the
 * internal framework abstractions.
 *
 * @implements {HttpAdapter}
 */
export class NodeHttpAdapter implements HttpAdapter {
  /** Content Parser instance for parsing body requests */
  private contentParser: ContentParserManager;

  /** Logger instance for request logging */
  private logger: Logger;

  /** Timestamp marking the start of request processing (for logging) */
  private startTime: bigint;

  /**
   * @param req - Native Node.js incoming request
   * @param res - Native Node.js server response
   */
  constructor(
    private readonly req: IncomingMessage,
    private readonly res: ServerResponse,
    loggerOptions: LoggerOptions = {},
  ) {
    this.startTime = process.hrtime.bigint();
    this.logger = new Logger(loggerOptions);
    this.contentParser = new ContentParserManager();
  }

  /**
   * Builds and returns a {@link Context} instance from
   * the incoming Node.js request.
   *
   * @returns A fully constructed {@link Context} instance
   */
  public async getContext(): Promise<Context> {
    const protocol = this.getProtocol();
    const url = new URL(
      this.req.url ?? "/",
      `${protocol}://${this.req.headers.host}`,
    );

    const request = new Request(url.pathname);
    request.setMethod((this.req.method as HttpMethods) ?? HttpMethods.get);
    request.setQuery(Object.fromEntries(url.searchParams.entries()));
    request.setHeaders(this.req.headers);
    request.setRemoteAddress(this.req.socket.remoteAddress);

    if (
      request.method === HttpMethods.post ||
      request.method === HttpMethods.put ||
      request.method === HttpMethods.patch
    ) {
      const parsedData = await this.contentParser.parse(this.req);
      request.setBody(parsedData as Record<string, any>);
    }

    return new Context(request);
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
      this.res.setHeader(header, value);
    }

    if (!response.content) this.res.removeHeader("Content-Type");

    this.logger.log(this.req, this.res, this.startTime);

    if (response.content instanceof Readable) {
      response.content.pipe(this.res);
      return;
    }

    this.res.end(response.content);
  }

  private getProtocol(): string {
    const forwarded = this.req.headers["x-forwarded-proto"];

    if (typeof forwarded === "string") {
      return forwarded.split(",")[0].trim();
    }

    if ((this.req.socket as TLSSocket).encrypted) {
      return "https";
    }

    return "http";
  }
}
