import { HttpMethods } from "./httpMethods";
import { Session } from "../sessions";
import type { UploadedFile } from "../parsers/parserInterface";
import { parseCookies } from "../sessions/cookies";
import { IncomingHttpHeaders } from "node:http";

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
  private _headers: IncomingHttpHeaders;

  /** Normalized HTTP method */
  private _method: HttpMethods;

  /** Parsed request body payload */
  private _body = Object.create(null) as Record<string, any>;

  /** Query string parameters */
  private _query = Object.create(null) as Record<string, unknown>;

  /** Dynamic route parameters (path params) */
  private _params = Object.create(null) as Record<string, unknown>;

  /** Session associated with the request */
  private _session: Session;

  /** Network peer address (adapter-provided). */
  private _remoteAddress?: string;

  /**
   * Per-request shared state container.
   *
   * This object can be freely used by middlewares and route handlers to store
   * arbitrary data during the request lifecycle.
   */
  public state = Object.create(null) as Record<string, unknown>;

  /** Multiple uploaded files metadata. */
  public files?: UploadedFile | UploadedFile[] | Record<string, UploadedFile[]>;

  constructor(url: string) {
    this._url = url;
  }

  get url(): string {
    return this._url;
  }

  get method(): HttpMethods {
    return this._method;
  }

  public setMethod(method: HttpMethods) {
    this._method = method;
  }

  get headers(): IncomingHttpHeaders {
    return this._headers;
  }

  public setHeaders(headers: IncomingHttpHeaders) {
    this._headers = headers;
  }

  get query(): Record<string, unknown> {
    return this._query;
  }

  public setQuery(query: Record<string, unknown>) {
    this._query = query;
  }

  get params(): Record<string, unknown> {
    return this._params;
  }

  public setParams(params: Record<string, unknown>) {
    this._params = params;
  }

  get body(): Record<string, any> {
    return this._body;
  }

  public setBody(body: Record<string, any>) {
    this._body = body;
  }

  get session(): Session {
    return this._session;
  }

  public setSession(session: Session) {
    this._session = session;
  }

  get remoteAddress(): string | undefined {
    return this._remoteAddress;
  }

  public setRemoteAddress(remoteAddress: string) {
    this._remoteAddress = remoteAddress;
  }

  /**
   * Returns all request cookies as a key-value object.
   */
  get cookies(): Record<string, string> {
    return parseCookies(this._headers?.cookie);
  }

  /**
   * Checks whether a cookie exists.
   */
  public hasCookie(name: string): boolean {
    return name in this.cookies;
  }
}
