import type { HttpAdapter } from "../http/httpAdapter";

export type RuntimeKind = "node" | "bun" | "deno";

export interface RuntimeListenOptions {
  port: number;
  hostname?: string;
  callback?: VoidFunction;
}

export type AdapterHandler = (adapter: HttpAdapter) => Promise<void>;

export interface RuntimeServer {
  listen(handler: AdapterHandler, options: RuntimeListenOptions): void;
}
