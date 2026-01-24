import { Layer } from "../routes/layer";
import { HttpMethods } from "../http/httpMethods";
import { IncomingHttpHeaders } from "node:http";
import { Response } from "../http/response";
import { Request } from "../http/request";

export type RouteHandler = (request: Request) => Response;
export type HashMapRouters = Partial<Record<HttpMethods, Layer[]>>;
export type Headers = IncomingHttpHeaders;
export type HttpValue = Record<string, unknown> | string | null;
export type NextFunction = (request: Request) => Response;
export type HelperFunction = (...args: unknown[]) => string;
export type TemplateContext = Record<string, unknown>;
