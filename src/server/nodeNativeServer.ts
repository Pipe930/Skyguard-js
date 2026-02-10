import { App } from "../app";
import { createServer } from "node:http";
import { NodeHttpAdapter } from "../http/nodeNativeHttp";

/**
 * Native Node.js HTTP server bootstrap.
 *
 * Responsible for starting the HTTP server and delegating
 * incoming requests to the framework core.
 */
export class NodeServer {
  /**
   * @param app - Framework core instance responsible for
   * handling the request lifecycle
   */
  constructor(private readonly app: App) {}

  /**
   * Starts the HTTP server and begins listening for incoming connections.
   *
   * For each request, a {@link NodeHttpAdapter} is created and passed
   * to the framework core.
   *
   * @param port - TCP port to listen on
   *
   * @example
   * const app = new App();
   * const server = new NodeServer(app);
   * server.listen(3000);
   */
  public listen(port: number): void {
    createServer((req, res) => {
      const adapter = new NodeHttpAdapter(req, res);
      void this.app.handle(adapter);
    }).listen(port);

    console.log(`Server running on http://localhost:${port}`);
  }
}
