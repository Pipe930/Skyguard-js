import { HttpMethods } from "./httpMethods";
import { Headers, HttpValue } from "../types";
import { Layer } from "../routing";
import { Validator } from "../validators";
import { FieldDefinition } from "../validators/core/validationSchema";
import { Session } from "sessions/session";

/**
 * Esta clase representa el contrato de entrada del framework: todo controlador
 * y middleware recibe una instancia de Request ya normalizada.
 *
 * El objeto Request es construido por un HttpAdapter
 * (ej: NodeHttpAdapter) y enriquecido durante el pipeline.
 *
 * @example
 * app.get("/users/{id}", (request) => {
 *   const id = request.getlayerParameters("id");
 *   return Response.json({ id });
 * });
 */
export class Request {
  /** Ruta normalizada de la solicitud (ej: '/api/users/42') */
  private url: string;

  /** Capa de enrutamiento que resolvió esta solicitud */
  private layer: Layer;

  /** Cabeceras HTTP entrantes */
  private headers: Headers;

  /** Método HTTP normalizado */
  private method: HttpMethods;

  /** Cuerpo de la petición (payload ya procesado) */
  private data: Record<string, any> = {};

  /** Parámetros de params string */
  private query: Record<string, string> = {};

  private session: Session;

  constructor(url: string) {
    this.url = url;
  }

  get getUrl(): string {
    return this.url;
  }

  get getMethod(): HttpMethods {
    return this.method;
  }

  public setMethod(method: HttpMethods): this {
    this.method = method;
    return this;
  }

  get getLayer(): Layer {
    return this.layer;
  }

  public setLayer(layer: Layer): this {
    this.layer = layer;
    return this;
  }

  get getHeaders(): Headers {
    return this.headers;
  }

  public setHeaders(headers: Headers): this {
    this.headers = headers;
    return this;
  }

  /**
   * Obtiene parámetros de params string.
   *
   * @example
   * // URL: /users?page=2&limit=10
   * request.getParams();        // { page: "2", limit: "10" }
   * request.getParams("page"); // "2"
   */
  public getQueryParams(key: string = null): HttpValue {
    if (key === null) return this.query;
    return this.query[key] ?? null;
  }

  public setQueryParams(query: Record<string, string>): this {
    this.query = query;
    return this;
  }

  /**
   * Obtiene parámetros dinámicos de la ruta (path params).
   *
   * @example
   * // Ruta: /users/{id}
   * // URL:  /users/42
   *
   * request.getlayerParameters();      // { id: "42" }
   * request.getlayerParameters("id");  // "42"
   */
  public getParams(key: string = null): HttpValue {
    const parameters = this.layer.parseParameters(this.url);
    if (key === null) return parameters;
    return parameters[key] ?? null;
  }

  /**
   * Obtiene el cuerpo de la petición (body / payload).
   *
   * @example
   * // POST /users
   * // Body: { "name": "Felipe" }
   *
   * request.getData();        // { name: "Felipe" }
   */
  public getData(): Record<string, unknown> {
    return this.data;
  }

  public setData(data: Record<string, any>): this {
    this.data = data;
    return this;
  }

  get getSession(): Session {
    return this.session;
  }

  public setSession(session: Session) {
    this.session = session;
  }

  public validateData(schema: Map<string, FieldDefinition>) {
    return Validator.validateOrFail(this.data, schema);
  }
}
