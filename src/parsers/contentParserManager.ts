import { IncomingMessage } from "node:http";
import type { ContentParser } from "./contentParser";
import { JsonParser } from "./jsonParser";
import { MultipartParser } from "./multipartParser";
import { TextParser } from "./textParser";
import { UrlEncodedParser } from "./urlEncodedParser";
import { XmlParser } from "./xmlParser";
import { UnprocessableContentError } from "../exceptions/httpExceptions";

/**
 * Main request body parsing manager.
 *
 * Coordinates multiple {@link ContentParser} implementations and
 * selects the appropriate one based on the request `Content-Type`.
 */
export class ContentParserManager {
  private parsers: ContentParser[] = [];

  constructor() {
    this.registerParser(new JsonParser());
    this.registerParser(new MultipartParser());
    this.registerParser(new UrlEncodedParser());
    this.registerParser(new TextParser());
    this.registerParser(new XmlParser());
  }

  /**
   * Registers a custom content parser.
   *
   * Parsers registered later take priority over existing ones.
   *
   * @param parser - Content parser implementation
   */
  public registerParser(parser: ContentParser): void {
    // Insert at the beginning to give higher priority
    this.parsers.unshift(parser);
  }

  /**
   * Parses the request body using the appropriate parser.
   *
   * The parser is selected based on the `Content-Type` header.
   * If no parser matches, the raw body is returned.
   *
   * @param req - Native incoming HTTP request
   * @returns Parsed body content or raw body
   */
  public async parse(
    req: IncomingMessage | globalThis.Request,
  ): Promise<unknown> {
    const isWebRequest = this.isWebRequest(req);
    const body = isWebRequest
      ? await this.readWebBody(req)
      : await this.readNodeBody(req);

    if (body.length <= 0) return {};

    const contentType = isWebRequest
      ? req.headers.get("content-type") || "text/plain"
      : req.headers["content-type"] || "text/plain";
    const parser = this.findParser(contentType);

    if (!parser) return Buffer.isBuffer(body) ? body : Buffer.from(body);

    return parser.parse(body, contentType);
  }

  /**
   * Reads the raw request body.
   *
   * @param req - Native incoming HTTP request
   * @returns A promise that resolves to the full body buffer
   */
  private readNodeBody(req: IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      req.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      req.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      req.on("error", () => {
        reject(new UnprocessableContentError("Failed to read request body"));
      });
    });
  }

  private async readWebBody(req: globalThis.Request): Promise<Buffer> {
    try {
      const arrayBuffer = await req.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch {
      throw new UnprocessableContentError("Failed to read request body");
    }
  }

  private isWebRequest(
    req: IncomingMessage | globalThis.Request,
  ): req is globalThis.Request {
    const candidate = req as {
      arrayBuffer?: unknown;
      headers?: { get?: unknown };
    };

    return (
      typeof candidate.arrayBuffer === "function" &&
      typeof candidate.headers?.get === "function"
    );
  }

  /**
   * Finds a parser capable of handling the given content type.
   *
   * @param contentType - Request `Content-Type` header
   * @returns Matching parser or `null` if none is found
   */
  private findParser(contentType: string): ContentParser | null {
    return this.parsers.find(parser => parser.canParse(contentType)) || null;
  }
}
