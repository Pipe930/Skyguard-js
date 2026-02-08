import { Container } from "../container/container";
import { App } from "../app";
import { Headers, TemplateContext } from "../types";

/**
 * Esta clase representa el contrato de salida del framework: todo controlador,
 * middleware o manejador de errores debe retornar una instancia de Response.
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
   * Código de estado HTTP de la respuesta.
   * @default 200
   */
  private status = 200;

  /**
   * Colección de cabeceras HTTP de la respuesta.
   */
  private headers: Headers = Object.create(null) as Headers;

  /**
   * Contenido del cuerpo de la respuesta.
   */
  private content: string | Buffer | null = null;

  get getStatus(): number {
    return this.status;
  }

  public setStatus(newStatus: number): this {
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
   * Atajo semántico para definir Content-Type.
   *
   * @param value Valor que le daras a la cabecera Content-Type
   * @returns Retorna una instancia de la clase {@link Response}
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
   * Prepara la respuesta antes de ser enviada al cliente.
   *
   * Este método es invocado por el adaptador HTTP
   * (por ejemplo NodeHttpAdapter) justo antes de escribir
   * la respuesta en el socket.
   *
   * @example
   * response.prepare();
   * adapter.send(response);
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
   * Crea una respuesta JSON.
   *
   * @param data Contenido en formato string o texto
   * @returns Retorna una instancia de la clase {@link Response}
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
   * Crea una respuesta de texto plano.
   *
   * @param data Contenido en formato string o texto
   * @returns Retorna una instancia de la clase {@link Response}
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
   * Crea una respuesta de redirección HTTP.
   * @param url Url donde quieres redirijir el flujo
   * @returns Retorna una instancia de la clase {@link Response}
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
   * Genera una respuesta HTTP de tipo text/html.
   *
   * Este método actúa como un *facade* entre el motor de vistas
   * y el sistema de respuestas HTTP del framework.
   *
   * Permite a los controladores retornar vistas de forma declarativa.
   *
   * @example
   * return Response.view("users/profile", { user });
   *
   * @example
   * return Response.view("auth/login", {}, "auth");
   *
   * @param view - Nombre lógico de la vista a renderizar
   * (sin extensión ni ruta base).
   * @param params - Variables que se inyectan
   * en la plantilla.
   * @param layout - Layout a utilizar. Si es `null`,
   * se usa el layout por defecto configurado en el motor de vistas.
   * @returns Respuesta HTTP lista para ser enviada al cliente.
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
