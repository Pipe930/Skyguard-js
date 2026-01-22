import { HttpMethods } from "./httpMethods";
import { Headers, HttpValue } from "../utils/types";
import { Layer } from "../routes/layer";

/**
 * Esta clase representa el contrato de entrada del framework: todo controlador
 * y middleware recibe una instancia de Request ya normalizada.
 *
 * A diferencia del IncomingMessage de Node, esta versión:
 * - Es inmutable desde fuera del core.
 * - Contiene información semántica (Layer, params, query).
 * - Permite acceso unificado a body, query y parámetros de ruta.
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
  protected url: string;

  /** Capa de enrutamiento que resolvió esta solicitud */
  protected layer: Layer;

  /** Cabeceras HTTP entrantes */
  protected headers: Headers;

  /** Método HTTP normalizado */
  protected method: HttpMethods;

  /** Cuerpo de la petición (payload ya procesado) */
  protected data: Record<string, any> = {};

  /** Parámetros de query string */
  protected query: Record<string, any> = {};

  /**
   * Obtiene la URL de la solicitud.
   *
   * @example
   * request.getUrl; // "/users/10"
   */
  get getUrl(): string {
    return this.url;
  }

  /**
   * Define la URL de la solicitud.
   * Usado exclusivamente por el HttpAdapter.
   */
  public setUrl(url: string): this {
    this.url = url;
    return this;
  }

  /**
   * Obtiene el método HTTP.
   *
   * @example
   * if (request.getMethod === HttpMethods.post) { ... }
   */
  get getMethod(): HttpMethods {
    return this.method;
  }

  /**
   * Define el método HTTP.
   * Usado por el HttpAdapter.
   */
  public setMethod(method: HttpMethods): this {
    this.method = method;
    return this;
  }

  /**
   * Obtiene la Layer asociada (ruta resuelta).
   *
   * Permite acceder a información estructural de la ruta.
   */
  get getLayer(): Layer {
    return this.layer;
  }

  /**
   * Asocia la capa de enrutamiento.
   * Este paso ocurre después del resolve del Router.
   */
  public setLayer(layer: Layer): this {
    this.layer = layer;
    return this;
  }

  /**
   * Obtiene las cabeceras HTTP entrantes.
   *
   * @example
   * const token = request.getHeaders["authorization"];
   */
  get getHeaders(): Headers {
    return this.headers;
  }

  /**
   * Define las cabeceras de la petición.
   * Usado por el HttpAdapter.
   */
  public setHeaders(headers: Headers): this {
    this.headers = headers;
    return this;
  }

  /**
   * Obtiene parámetros de query string.
   *
   * @example
   * // URL: /users?page=2&limit=10
   * request.getParams();        // { page: "2", limit: "10" }
   * request.getParams("page"); // "2"
   */
  public getParams(key: string = null): HttpValue {
    if (key === null) return this.query;
    return (this.query[key] as string) ?? null;
  }

  /**
   * Define los parámetros de query.
   * Usado por el HttpAdapter.
   */
  public setQueryParameters(query: Record<string, any>): this {
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
  public getlayerParameters(key: string = null): HttpValue {
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
   * request.getData("name"); // "Felipe"
   */
  public getData(key: string = null): HttpValue {
    if (key === null) return this.data;
    return (this.data[key] as string) ?? null;
  }

  /**
   * Define el cuerpo de la petición.
   * Usado por el HttpAdapter tras parsear el stream.
   */
  public setData(data: Record<string, any>): this {
    this.data = data;
    return this;
  }
}
