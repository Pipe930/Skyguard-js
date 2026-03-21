import { createServer } from "node:http";
import { NodeHttpAdapter } from "../http/nodeNativeHttp";
import type { LoggerOptions } from "../http/logger";
import type { RuntimeListenOptions, RuntimeServer, AdapterHandler } from "./types";

export class NodeRuntimeServer implements RuntimeServer {
  constructor(private readonly loggerOptions: LoggerOptions = {}) {}

  public listen(handler: AdapterHandler, options: RuntimeListenOptions): void {
    createServer((req, res) => {
      const adapter = new NodeHttpAdapter(req, res, this.loggerOptions);
      void handler(adapter);
    }).listen(options.port, options.hostname, () => {
      if (options.callback) options.callback();
    });
  }
}
