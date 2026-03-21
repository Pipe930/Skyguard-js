import { HttpMethods } from "./httpMethods";
import type { HttpAdapter } from "./httpAdapter";
import { Response } from "./response";
import { Request } from "./request";
import { Context } from "./context";
import { ContentParserManager } from "../parsers/contentParserManager";
import { NotImplementedError } from "../exceptions/httpExceptions";
import { Readable } from "node:stream";
import { type LoggerOptions, Logger } from "./logger";

type WebRequest = globalThis.Request;
type WebResponse = globalThis.Response;

export class WebHttpAdapter implements HttpAdapter {
  private contentParser: ContentParserManager;
  private logger: Logger;
  private startTimeMs: number;
  private runtimeResponse: WebResponse | null = null;

  constructor(
    private readonly req: WebRequest,
    loggerOptions: LoggerOptions = {},
  ) {
    this.contentParser = new ContentParserManager();
    this.logger = new Logger(loggerOptions);
    this.startTimeMs = performance.now();
  }

  public async getContext(): Promise<Context> {
    const url = new URL(this.req.url);
    const request = new Request(url.pathname);

    request.setMethod(
      ((this.req.method || "GET").toUpperCase() as HttpMethods) ||
        HttpMethods.get,
    );
    request.setQuery(Object.fromEntries(url.searchParams.entries()));
    request.setHeaders(this.buildHeaders());

    if (
      request.method === HttpMethods.post ||
      request.method === HttpMethods.put ||
      request.method === HttpMethods.patch
    ) {
      const parsedData = await this.contentParser.parse(this.req);
      request.setBody(parsedData as Record<string, unknown>);
    }

    return new Context(request);
  }

  public sendResponse(response: Response): void {
    response.prepare();
    const headers = new Headers();

    for (const [header, value] of Object.entries(response.headers)) {
      if (Array.isArray(value)) {
        for (const entry of value) {
          headers.append(header, entry);
        }
        continue;
      }

      if (typeof value !== "undefined") {
        headers.set(header, String(value));
      }
    }

    if (!response.content) {
      headers.delete("content-type");
      this.runtimeResponse = new globalThis.Response(null, {
        status: response.statusCode,
        headers,
      });
      this.logger.logWeb(this.req, this.runtimeResponse, this.startTimeMs);
      return;
    }

    if (response.content instanceof Readable) {
      throw new NotImplementedError(
        "Node.js Readable stream responses are not supported in this runtime",
      );
    }

    const body =
      typeof response.content === "string"
        ? response.content
        : new Uint8Array(response.content);

    this.runtimeResponse = new globalThis.Response(body, {
      status: response.statusCode,
      headers,
    });

    this.logger.logWeb(this.req, this.runtimeResponse, this.startTimeMs);
  }

  public toWebResponse(): WebResponse {
    return (
      this.runtimeResponse ||
      new globalThis.Response("No response generated", {
        status: 500,
      })
    );
  }

  private buildHeaders(): Record<string, string | string[] | undefined> {
    const headers = Object.create(null) as Record<
      string,
      string | string[] | undefined
    >;

    for (const [key, value] of this.req.headers.entries()) {
      if (typeof headers[key] === "undefined") {
        headers[key] = value;
        continue;
      }

      if (Array.isArray(headers[key])) {
        headers[key] = [...headers[key], value];
        continue;
      }

      headers[key] = [headers[key], value];
    }

    return headers;
  }
}
