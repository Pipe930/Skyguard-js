import { Container } from "../container/container";
import { App } from "../app";
import type { Headers, TemplateContext } from "../types";
import { statusCodes } from "./statusCodes";
import { InvalidHttpStatusException } from "../exceptions";

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
  private status = 200;

  /**
   * Collection of response headers.
   */
  private headers: Headers = Object.create(null) as Headers;

  /**
   * Response body content.
   */
  private content: string | Buffer | null = null;

  get getStatus(): number {
    return this.status;
  }

  public setStatus(newStatus: number): this {
    const status = statusCodes[newStatus] ?? null;
    if (!status) throw new InvalidHttpStatusException(newStatus);
    this.status = newStatus;
    return this;
  }

  get getHeaders(): Headers {
    return this.headers;
  }

  public setHeaders(headers: Headers): this {
    this.headers = this.merge(this.headers, headers);
    return this;
  }

  private merge<T, U>(a: T, b: U): T & U {
    return { ...a, ...b };
  }

  public setHeader(header: string, value: string): this {
    this.headers[header] = value;
    return this;
  }

  public removeHeader(header: string): void {
    delete this.headers[header];
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
    this.headers["content-type"] = value;
    return this;
  }

  get getContent(): string | Buffer | null {
    return this.content;
  }

  public setContent(content: string | Buffer): this {
    this.content = content;
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
    if (!this.headers["content-type"] && this.content) {
      if (Buffer.isBuffer(this.content)) {
        this.headers["content-type"] = "application/octet-stream";
      } else {
        this.headers["content-type"] = "text/plain";
      }
    }

    if (this.content && !this.headers["content-length"]) {
      const length = Buffer.isBuffer(this.content)
        ? this.content.length
        : Buffer.byteLength(this.content, "utf-8");

      this.headers["content-length"] = length.toString();
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
    return new this().setStatus(302).setHeader("location", url);
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
    view: string,
    params: TemplateContext,
    layout: string = null,
  ): Promise<Response> {
    const content = await Container.resolve(App).view.render(
      view,
      params,
      layout,
    );

    return new this().setContentType("text/html").setContent(content);
  }
}
