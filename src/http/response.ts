import type { Headers } from "../types";
import { statusCodes } from "./statusCodes";
import { InvalidHttpStatusException } from "../exceptions/invalidHttpStatusException";
import { FileDownloadHelper } from "../static/fileDownload";
import { ViewEngine } from "../views/engineTemplate";
import { Container } from "../container/container";
import { type CookieOptions, serializeCookie } from "../sessions/cookies";

/**
 * Represents an outgoing response sent to the client.
 *
 * Provides a fluent API to define status codes, headers, and body content,
 * independent of the underlying HTTP runtime.
 *
 * @example
 * return new Response()
 *   .setStatus(201)
 *   .setContentType("application/json")
 *   .setContent(JSON.stringify({ id: 10 }));
 *
 * @example
 * return Response.json({ ok: true });
 */
export class Response {
  /**
   * HTTP status code.
   * @default 200
   */
  private _statusCode = 200;

  /**
   * Collection of response headers.
   */
  private _headers: Headers = Object.create(null) as Headers;

  /**
   * Response body content.
   */
  private _content: string | Buffer | null = null;

  get statusCode(): number {
    return this._statusCode;
  }

  public setStatusCode(newStatus: number): this {
    const status = statusCodes[newStatus] ?? null;
    if (!status) throw new InvalidHttpStatusException(newStatus);
    this._statusCode = newStatus;
    return this;
  }

  get headers(): Headers {
    return this._headers;
  }

  public setHeaders(headers: Headers): this {
    this._headers = this.merge(this._headers, headers);
    return this;
  }

  private merge<T, U>(a: T, b: U): T & U {
    return { ...a, ...b };
  }

  public setHeader(header: string, value: string): this {
    this._headers[header] = value;
    return this;
  }

  public removeHeader(header: string): void {
    delete this._headers[header];
  }

  /**
   * Sets a cookie in the `Set-Cookie` response header.
   */
  public setCookie(
    name: string,
    value: string,
    options: CookieOptions = {},
  ): this {
    const cookie = serializeCookie(name, value, options);
    const current = this._headers["Set-Cookie"];

    if (!current) {
      this._headers["Set-Cookie"] = cookie;
      return this;
    }

    if (Array.isArray(current)) {
      this._headers["Set-Cookie"] = [...current, cookie];
      return this;
    }

    this._headers["Set-Cookie"] = [current, cookie];
    return this;
  }

  /**
   * Clears a cookie by setting an empty value and immediate expiration.
   */
  public removeCookie(name: string, options: CookieOptions = {}): this {
    return this.setCookie(name, "", {
      ...options,
      maxAge: 0,
    });
  }

  /**
   * Semantic shortcut to define the `Content-Type` header.
   *
   * @param value - Value for the `Content-Type` header
   * @returns The current {@link Response} instance
   *
   * @example
   * return new Response()
   *   .setContentType("text/html")
   *   .setContent("<h1>Hello</h1>");
   */
  public setContentType(value: string): this {
    this._headers["content-type"] = value;
    return this;
  }

  get content(): string | Buffer | null {
    return this._content;
  }

  public setContent(content: string | Buffer): this {
    this._content = content;
    return this;
  }

  /**
   * Prepares the response before being sent to the client.
   *
   * This method is called by the HTTP adapter (e.g. NodeHttpAdapter)
   * right before writing to the underlying socket.
   *
   * It automatically sets:
   * - `Content-Type` if missing
   * - `Content-Length` if missing
   *
   * @example
   * response.prepare();
   * adapter.sendResponse(response);
   */
  public prepare(): void {
    if (!this._headers["content-type"] && this._content) {
      if (Buffer.isBuffer(this._content)) {
        this._headers["content-type"] = "application/octet-stream";
      } else {
        this._headers["content-type"] = "text/plain";
      }
    }

    if (this._content && !this._headers["content-length"]) {
      const length = Buffer.isBuffer(this._content)
        ? this._content.length
        : Buffer.byteLength(this._content, "utf-8");

      this._headers["content-length"] = length.toString();
    }
  }

  /**
   * Creates a JSON response.
   *
   * @param data - Data to be serialized as JSON
   * @returns A {@link Response} instance
   *
   * @example
   * app.get("/users", () => {
   *   return Response.json([{ id: 1 }, { id: 2 }]);
   * });
   */
  public static json<T>(data: T): Response {
    return new this()
      .setContentType("application/json")
      .setContent(JSON.stringify(data));
  }

  /**
   * Creates a plain text response.
   *
   * @param data - Text content
   * @returns A {@link Response} instance
   *
   * @example
   * app.get("/", () => {
   *   return Response.text("Hello world");
   * });
   */
  public static text(data: string): Response {
    return new this().setContentType("text/plain").setContent(data);
  }

  /**
   * Creates an HTTP redirect response.
   *
   * @param url - Target URL to redirect to
   * @returns A {@link Response} instance
   *
   * @example
   * app.get("/old-route", () => {
   *   return Response.redirect("/new-route");
   * });
   */
  public static redirect(url: string): Response {
    return new this().setStatusCode(302).setHeader("location", url);
  }

  public static async download(
    path: string,
    filename?: string,
    headers?: Record<string, string>,
  ): Promise<Response> {
    const downloadClass = new FileDownloadHelper();
    const { content, downloadHeaders } = await downloadClass.download(
      path,
      filename,
      headers,
    );
    return new this().setContent(content).setHeaders(downloadHeaders);
  }

  /**
   * Renders an HTML view and returns it as an HTTP response.
   *
   * Acts as a facade between the view engine and the HTTP response system.
   *
   * @param view - Logical view name (without extension or base path)
   * @param params - Template variables
   * @param layout - Optional layout name. If `null`, the default layout is used
   * @returns A ready-to-send {@link Response} instance
   *
   * @example
   * return Response.render("users/profile", { user });
   * return Response.render("auth/login", {}, "auth");
   */
  public static async render(
    data: string,
    params?: Record<string, unknown>,
  ): Promise<Response> {
    const viewEngine = Container.resolve(ViewEngine);

    if (viewEngine.hasEngine())
      data = await viewEngine.render(data, params ?? {});

    return new this()
      .setContentType("text/html; charset=utf-8")
      .setContent(Buffer.from(data, "utf-8"));
  }
}
