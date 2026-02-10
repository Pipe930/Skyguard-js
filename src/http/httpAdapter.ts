import { Request } from "./request";
import { Response } from "./response";

/**
 * High-level contract that defines the framework entry port
 * to the outside world (HTTP, sockets, runtimes, etc.).
 *
 * This interface allows the framework core to be fully decoupled
 * from any concrete server implementation (Node.js, Bun, Deno, Cloudflare, etc.).
 */
export interface HttpAdapter {
  /**
   * Builds and returns a {@link Request} instance from
   * the current connection context.
   *
   * @returns A promise that resolves to a {@link Request} object
   */
  getRequest(): Promise<Request>;

  /**
   * Sends a {@link Response} to the client, mapping its status,
   * headers, and body to the underlying runtime protocol.
   *
   * @param response - {@link Response} object containing
   * the outgoing data defined by the application
   */
  sendResponse(response: Response): void;
}
