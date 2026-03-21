import { WebHttpAdapter } from "../http/webHttp";
import type { LoggerOptions } from "../http/logger";
import type { AdapterHandler, RuntimeListenOptions, RuntimeServer } from "./types";

interface DenoServeResult {
  finished: Promise<void>;
}

interface DenoGlobal {
  serve(
    options: {
      hostname?: string;
      port: number;
    },
    handler: (request: globalThis.Request) => Promise<globalThis.Response>,
  ): DenoServeResult;
}

export class DenoRuntimeServer implements RuntimeServer {
  constructor(private readonly loggerOptions: LoggerOptions = {}) {}

  public listen(handler: AdapterHandler, options: RuntimeListenOptions): void {
    const deno = (globalThis as { Deno?: DenoGlobal }).Deno;

    if (!deno) {
      throw new Error("Deno runtime not detected");
    }

    deno.serve(
      {
        hostname: options.hostname,
        port: options.port,
      },
      async (request: globalThis.Request) => {
        const adapter = new WebHttpAdapter(request, this.loggerOptions);
        await handler(adapter);
        return adapter.toWebResponse();
      },
    );

    if (options.callback) options.callback();
  }
}
