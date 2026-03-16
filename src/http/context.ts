import { IncomingHttpHeaders } from "node:http";
import { Request } from "./request";
import { Response } from "./response";
import { Readable } from "node:stream";
import { Session } from "../sessions";

/**
 * Unified HTTP context shared by middleware and route handlers.
 *
 * This object wraps the current {@link Request} and exposes convenient
 * read-only accessors (`headers`, `body`, `params`, etc.) plus response
 * builder helpers (`json`, `text`, `redirect`, `stream`, `download`).
 *
 * @example
 * app.get("/users/{id}", context => {
 *   return context.json({
 *     id: context.params.id,
 *     ip: context.remoteAddress,
 *   });
 * });
 */
export class Context {
  /**
   * @param _req - Current request wrapper instance.
   */
  constructor(private readonly _req: Request) {
    this._req = _req;
  }

  /**
   * Returns a new empty response instance.
   *
   * Useful when constructing a response manually.
   */
  get res(): Response {
    return new Response();
  }

  /**
   * Returns the underlying request object.
   */
  get req(): Request {
    return this._req;
  }

  /**
   * Returns incoming request headers.
   */
  get headers(): IncomingHttpHeaders {
    return this._req.headers;
  }

  /**
   * Returns the socket peer IP address when available.
   */
  get remoteAddress(): string | undefined {
    return this._req.remoteAddress;
  }

  /**
   * Returns parsed request body.
   */
  get body(): Record<string, any> {
    return this._req.body;
  }

  /**
   * Returns route path parameters.
   */
  get params(): Record<string, any> {
    return this._req.params;
  }

  /**
   * Returns parsed query string values.
   */
  get query(): Record<string, any> {
    return this._req.query;
  }

  /**
   * Returns parsed request cookies.
   */
  get cookies(): Record<string, string> {
    return this._req.cookies;
  }

  /**
   * Returns request session wrapper.
   */
  get session(): Session {
    return this._req.session;
  }

  /**
   * Creates a JSON response.
   *
   * @param data - Serializable payload.
   */
  public json(data: unknown): Response {
    return Response.json(data);
  }

  /**
   * Creates a plain-text response.
   *
   * @param data - Text payload.
   */
  public text(data: string): Response {
    return Response.text(data);
  }

  /**
   * Creates an HTTP redirect response (302 by default).
   *
   * @param url - Redirect target URL.
   */
  public redirect(url: string): Response {
    return Response.redirect(url);
  }

  /**
   * Creates a streaming response.
   *
   * @param stream - Readable stream body.
   * @param headers - Optional extra headers.
   */
  public stream(stream: Readable, headers?: Record<string, string>): Response {
    return Response.stream(stream, headers);
  }

  /**
   * Creates a download response from a filesystem path.
   *
   * @param path - File path.
   * @param filename - Optional download filename.
   * @param headers - Optional additional headers.
   */
  public async download(
    path: string,
    filename?: string,
    headers?: Record<string, string>,
  ): Promise<Response> {
    return await Response.download(path, filename, headers);
  }

  /**
   * Renders a configured template with optional params.
   *
   * @param data - Template source or identifier depending on view engine setup.
   * @param params - Template context values.
   */
  public async render(
    data: string,
    params?: Record<string, unknown>,
  ): Promise<Response> {
    return await Response.render(data, params);
  }

  /**
   * Sends a file for inline display.
   *
   * @param filePath - File path to send.
   * @param options - Optional root and headers.
   */
  public async sendFile(
    filePath: string,
    options: {
      headers?: Record<string, string>;
      root?: string;
    },
  ): Promise<Response> {
    return await Response.sendFile(filePath, options);
  }
}
