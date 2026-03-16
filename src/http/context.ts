import { IncomingHttpHeaders } from "node:http";
import { Request } from "./request";
import { Response } from "./response";
import { Readable } from "node:stream";
import { Session } from "../sessions";

/**
 * Unified request/response context
 */
export class Context {
  constructor(private readonly _req: Request) {
    this._req = _req;
  }

  get res(): Response {
    return new Response();
  }

  get req(): Request {
    return this._req;
  }

  get headers(): IncomingHttpHeaders {
    return this._req.headers;
  }

  get body(): Record<string, any> {
    return this._req.body;
  }

  get params(): Record<string, any> {
    return this._req.params;
  }

  get query(): Record<string, any> {
    return this._req.query;
  }

  get cookies(): Record<string, string> {
    return this._req.cookies;
  }

  get session(): Session {
    return this._req.session;
  }

  public json(data: unknown): Response {
    return Response.json(data);
  }

  public text(data: string): Response {
    return Response.text(data);
  }

  public redirect(url: string): Response {
    return Response.redirect(url);
  }

  public stream(stream: Readable, headers?: Record<string, string>): Response {
    return Response.stream(stream, headers);
  }

  public async download(
    path: string,
    filename?: string,
    headers?: Record<string, string>,
  ): Promise<Response> {
    return await Response.download(path, filename, headers);
  }

  public async render(
    data: string,
    params?: Record<string, unknown>,
  ): Promise<Response> {
    return await Response.render(data, params);
  }

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
