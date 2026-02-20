import { HttpMethods } from "./httpMethods";
import type { Headers, HttpValue } from "../types";
import { Layer } from "../routing/layer";
import { Validator, FieldDefinition } from "../validators";
import { Session } from "../sessions";

/**
 * Represents an incoming client request within the framework.
 *
 * This class provides a normalized abstraction over the incoming
 * HTTP request, independent of the underlying runtime.
 *
 * @example
 * app.get("/users/{id}", (request) => {
 *   const id = request.getParams("id");
 *   return Response.json({ id });
 * });
 */
export class Request {
  /** Normalized request path (e.g. "/api/users/42") */
  private url: string;

  /** Incoming HTTP headers */
  private headers: Headers;

  /** Normalized HTTP method */
  private method: HttpMethods;

  /** Parsed request body payload */
  private data: Record<string, any> = {};

  /** Query string parameters */
  private query: Record<string, string> = {};

  /** Dynamic route parameters (path params) */
  private params: Record<string, string> = {};

  /** Session associated with the request */
  private session: Session;

  public state: Record<string, any> = {};

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

  get getHeaders(): Headers {
    return this.headers;
  }

  public setHeaders(headers: Headers): this {
    this.headers = headers;
    return this;
  }

  /**
   * Returns query string parameters.
   *
   * If no key is provided, all query parameters are returned.
   *
   * @param key - Optional query parameter name
   * @returns A single value, all parameters, or `null` if not found
   *
   * @example
   * // URL: /users?page=2&limit=10
   * request.getQueryParams();        // { page: "2", limit: "10" }
   * request.getQueryParams("page"); // "2"
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
   * Returns dynamic route parameters (path params).
   *
   * These parameters are resolved by the routing layer based on
   * the matched route pattern.
   *
   * @param key - Optional parameter name
   * @returns A single value, all parameters, or `null` if not found
   *
   * @example
   * // Route: /users/{id}
   * // URL:   /users/42
   *
   * request.getParams();     // { id: "42" }
   * request.getParams("id"); // "42"
   */
  public getParams(key: string = null): HttpValue {
    if (key === null) return this.params;
    return this.params[key] ?? null;
  }

  public setParams(params: Record<string, string>): this {
    this.params = params;
    return this;
  }

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

  /**
   * Validates the request payload against a validation schema.
   *
   * Throws if validation fails.
   *
   * @param schema - Validation rules mapped by field name
   */
  public validateData(schema: Map<string, FieldDefinition>) {
    return Validator.validateOrFail(this.data, schema);
  }
}
