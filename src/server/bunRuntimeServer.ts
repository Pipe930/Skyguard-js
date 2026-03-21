import { WebHttpAdapter } from "../http/webHttp";
import type { LoggerOptions } from "../http/logger";
import type { AdapterHandler, RuntimeListenOptions, RuntimeServer } from "./types";

interface BunGlobal {
  serve(options: {
    hostname?: string;
    port: number;
    fetch: (request: globalThis.Request) => Promise<globalThis.Response>;
  }): unknown;
}

export class BunRuntimeServer implements RuntimeServer {
  constructor(private readonly loggerOptions: LoggerOptions = {}) {}

  public listen(handler: AdapterHandler, options: RuntimeListenOptions): void {
    const bun = (globalThis as { Bun?: BunGlobal }).Bun;

    if (!bun) {
      throw new Error("Bun runtime not detected");
    }

    bun.serve({
      hostname: options.hostname,
      port: options.port,
      fetch: async (request: globalThis.Request) => {
        const adapter = new WebHttpAdapter(request, this.loggerOptions);
        await handler(adapter);
        return adapter.toWebResponse();
      },
    });

    if (options.callback) options.callback();
  }
}
