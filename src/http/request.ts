import { HttpMethods } from "./httpMethods";
import type { Headers } from "../types";
import { Validator, type FieldDefinition } from "../validators";
import { Session } from "../sessions";
import type { UploadedFile } from "../parsers/parserInterface";
import { parseCookies } from "../sessions/cookies";

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
  private _url: string;

  /** Incoming HTTP headers */
  private _headers: Headers;

  /** Normalized HTTP method */
  private _method: HttpMethods;

  /** Parsed request body payload */
  private _data: Record<string, any> = {};

  /** Query string parameters */
  private _query: Record<string, string> = {};

  /** Dynamic route parameters (path params) */
  private _params: Record<string, string> = {};

  /** Session associated with the request */
  private _session: Session;

  /**
   * Per-request shared state container.
   *
   * This object can be freely used by middlewares and route handlers to store
   * arbitrary data during the request lifecycle.
   */
  public state: Record<string, any> = {};

  /** Single uploaded file metadata. */
  public file?: UploadedFile;

  /** Multiple uploaded files metadata. */
  public files?: UploadedFile[] | Record<string, UploadedFile[]>;

  constructor(url: string) {
    this._url = url;
  }

  get url(): string {
    return this._url;
  }

  get method(): HttpMethods {
    return this._method;
  }

  public setMethod(method: HttpMethods): this {
    this._method = method;
    return this;
  }

  get headers(): Headers {
    return this._headers;
  }

  public setHeaders(headers: Headers): this {
    this._headers = headers;
    return this;
  }

  get query(): Record<string, string> {
    return this._query;
  }

  public setQuery(query: Record<string, string>): this {
    this._query = query;
    return this;
  }

  get params(): Record<string, string> {
    return this._params;
  }

  public setParams(params: Record<string, string>): this {
    this._params = params;
    return this;
  }

  get data(): Record<string, unknown> {
    return this._data;
  }

  public setData(data: Record<string, any>): this {
    this._data = data;
    return this;
  }

  get session(): Session {
    return this._session;
  }

  public setSession(session: Session) {
    this._session = session;
  }

  /**
   * Returns all request cookies as a key-value object.
   */
  get cookies(): Record<string, string> {
    return parseCookies(this._headers?.cookie);
  }

  /**
   * Returns a cookie value by name.
   */
  public getCookie(name: string): string | undefined {
    return this.cookies[name];
  }

  /**
   * Checks whether a cookie exists.
   */
  public hasCookie(name: string): boolean {
    return name in this.cookies;
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
