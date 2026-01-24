import { App } from "../app";
import { Headers, TemplateContext } from "../utils/types";

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
   * Se inicializa sin prototipo para evitar colisiones
   * con propiedades heredadas de Object.
   */
  private headers: Headers = Object.create(null) as Headers;

  /**
   * Contenido del cuerpo de la respuesta.
   */
  private content?: string = null;

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
   * @example
   * return new Response()
   *   .setContentType("text/html")
   *   .setContent("<h1>Hello</h1>");
   */
  public setContentType(value: string): this {
    this.headers["content-type"] = value;
    return this;
  }

  get getContent(): string | null {
    return this.content;
  }

  public setContent(content: string): this {
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
   * Se encarga de:
   * - Calcular Content-Length automáticamente.
   * - Limpiar cabeceras si no existe cuerpo.
   *
   * @example
   * response.prepare();
   * adapter.send(response);
   */
  public prepare(): void {
    if (!this.content) {
      this.removeHeader("content-type");
      this.removeHeader("content-length");
    } else {
      this.setHeader("content-length", this.content.length.toString());
    }
  }

  /**
   * Crea una respuesta JSON.
   *
   * Es el método estándar para APIs REST.
   *
   * @example
   * app.get("/users", () => {
   *   return Response.json([{ id: 1 }, { id: 2 }]);
   * });
   */
  public static json(data: unknown): Response {
    return new this()
      .setContentType("application/json")
      .setContent(JSON.stringify(data));
  }

  /**
   * Crea una respuesta de texto plano.
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
   *
   * @example
   * app.get("/old-route", () => {
   *   return Response.redirect("/new-route");
   * });
   */
  public static redirect(url: string): Response {
    return new this().setStatus(302).setHeader("location", url);
  }

  public static view(
    view: string,
    params: TemplateContext,
    layout: string = null,
    app: App,
  ): Response {
    const content = app.engineTemplate.render(view, params, layout);

    return new this().setContentType("text/html").setContent(content);
  }
}
