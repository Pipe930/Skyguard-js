import { IncomingMessage, ServerResponse } from "node:http";

/**
 * Minimal HTTP request logger.
 *
 * This logger writes a single line per request to a writable stream
 * (stdout by default). It is designed to be called after a response has
 * finished so it can log status code, response size and execution time.
 *
 * Example output:
 * `GET /api/users 200 3.421 ms - 512`
 *
 * Status codes are colorized using ANSI escape sequences:
 * - 2xx → green
 * - 3xx → cyan
 * - 4xx → yellow
 * - 5xx → red
 */
export class Logger {
  private stream: NodeJS.WritableStream;

  constructor() {
    this.stream = process.stdout;
  }

  /**
   * Logs an HTTP request/response pair.
   *
   * Intended usage:
   * - Capture `startTime = process.hrtime.bigint()` when the request starts.
   * - Call `logger.log(req, res, startTime)` once the response finishes.
   *
   * The log line contains:
   * - HTTP method
   * - Request URL
   * - Status code (colorized)
   * - Response time in milliseconds (high-resolution)
   * - Response content-length header (if present)
   *
   * @param req - Node.js IncomingMessage representing the request.
   * @param res - Node.js ServerResponse representing the response.
   * @param startTime - High-resolution timestamp captured at request start using `process.hrtime.bigint()`.
   */
  public log(
    req: IncomingMessage,
    res: ServerResponse,
    startTime: bigint,
  ): void {
    const method = req.method || "-";
    const url = req.url || "-";
    const contentLength = res.getHeader("content-length") || "-";

    const diff = process.hrtime.bigint() - startTime;
    const responseTime = (Number(diff) / 1_000_000).toFixed(3);
    const coloredStatus = this.colorizeStatus(res.statusCode);
    const logLine = `${method} ${url} ${coloredStatus} ${responseTime} ms - ${contentLength.toString()}`;

    this.stream.write(logLine + "\n");
  }

  /**
   * Applies ANSI color codes to an HTTP status code for terminal output.
   *
   * Color mapping:
   * - 500–599 → red (server errors)
   * - 400–499 → yellow (client errors)
   * - 300–399 → cyan (redirects)
   * - 200–299 → green (successful responses)
   * - <200 → no color
   *
   * @param statusCode - HTTP status code.
   * @returns Colorized status code string suitable for terminal output.
   */
  private colorizeStatus(statusCode: number): string {
    const statusStr = String(statusCode);

    if (statusCode >= 500) {
      return `\x1b[31m${statusStr}\x1b[0m`;
    } else if (statusCode >= 400) {
      return `\x1b[33m${statusStr}\x1b[0m`;
    } else if (statusCode >= 300) {
      return `\x1b[36m${statusStr}\x1b[0m`;
    } else if (statusCode >= 200) {
      return `\x1b[32m${statusStr}\x1b[0m`;
    }

    return statusStr;
  }
}
