import { IncomingMessage, ServerResponse } from "node:http";

export type LogFormat = "combined" | "common" | "dev" | "short" | "tiny";

export type LoggerOptions = {
  format?: LogFormat;
  stream?: { write(chunk: string): unknown };
  fileStream?: { write(chunk: string): unknown };
};

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
  private stream: { write(chunk: string): unknown };
  private fileStream?: { write(chunk: string): unknown };
  private format: LogFormat;

  constructor(options: LoggerOptions = {}) {
    this.stream = options.stream || this.getDefaultStream();
    this.fileStream = options.fileStream;
    this.format = options.format || "dev";
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
    const diff = process.hrtime.bigint() - startTime;
    const responseTime = (Number(diff) / 1_000_000).toFixed(3);
    const consoleLine = this.buildLogLine(req, res, responseTime, true);
    const fileLine = this.buildLogLine(req, res, responseTime, false);

    this.stream.write(consoleLine + "\n");

    if (this.fileStream) {
      this.fileStream.write(fileLine + "\n");
    }
  }

  public logWeb(
    req: globalThis.Request,
    res: globalThis.Response,
    startTimeMs: number,
  ): void {
    const responseTime = (performance.now() - startTimeMs).toFixed(3);
    const consoleLine = this.buildWebLogLine(req, res, responseTime, true);
    const fileLine = this.buildWebLogLine(req, res, responseTime, false);

    this.stream.write(consoleLine + "\n");

    if (this.fileStream) {
      this.fileStream.write(fileLine + "\n");
    }
  }

  private buildLogLine(
    req: IncomingMessage,
    res: ServerResponse,
    responseTime: string,
    useColor: boolean,
  ): string {
    const method = req.method || "-";
    const url = req.url || "-";
    const statusCode = useColor
      ? this.colorizeStatus(res.statusCode)
      : String(res.statusCode);
    const contentLength = res.getHeader("content-length")?.toString() || "-";
    const remoteAddr = req.socket.remoteAddress || "-";
    const httpVersion = req.httpVersion || "1.1";
    const referrerHeader = req.headers.referer || req.headers.referrer;
    const referrer = Array.isArray(referrerHeader)
      ? referrerHeader.join(", ")
      : referrerHeader || "-";
    const userAgentHeader = req.headers["user-agent"];
    const userAgent = Array.isArray(userAgentHeader)
      ? userAgentHeader.join(", ")
      : userAgentHeader || "-";
    const date = new Date().toUTCString();

    if (this.format === "tiny") {
      return `${method} ${url} ${statusCode} ${contentLength} - ${responseTime} ms`;
    }

    if (this.format === "short") {
      return `${remoteAddr} ${method} ${url} ${statusCode} ${contentLength} - ${responseTime} ms`;
    }

    if (this.format === "common") {
      return `${remoteAddr} - - [${date}] "${method} ${url} HTTP/${httpVersion}" ${statusCode} ${contentLength}`;
    }

    if (this.format === "combined") {
      return `${remoteAddr} - - [${date}] "${method} ${url} HTTP/${httpVersion}" ${statusCode} ${contentLength} "${referrer}" "${userAgent}"`;
    }

    return `${method} ${url} ${statusCode} ${responseTime} ms - ${contentLength}`;
  }

  private buildWebLogLine(
    req: globalThis.Request,
    res: globalThis.Response,
    responseTime: string,
    useColor: boolean,
  ): string {
    const method = req.method || "-";
    const url = new URL(req.url).pathname || "-";
    const statusCode = useColor
      ? this.colorizeStatus(res.status)
      : String(res.status);
    const contentLength = res.headers.get("content-length") || "-";
    const remoteAddr = req.headers.get("x-forwarded-for") || "-";
    const httpVersion = "1.1";
    const referrer = req.headers.get("referer") || req.headers.get("referrer") || "-";
    const userAgent = req.headers.get("user-agent") || "-";
    const date = new Date().toUTCString();

    if (this.format === "tiny") {
      return `${method} ${url} ${statusCode} ${contentLength} - ${responseTime} ms`;
    }

    if (this.format === "short") {
      return `${remoteAddr} ${method} ${url} ${statusCode} ${contentLength} - ${responseTime} ms`;
    }

    if (this.format === "common") {
      return `${remoteAddr} - - [${date}] "${method} ${url} HTTP/${httpVersion}" ${statusCode} ${contentLength}`;
    }

    if (this.format === "combined") {
      return `${remoteAddr} - - [${date}] "${method} ${url} HTTP/${httpVersion}" ${statusCode} ${contentLength} "${referrer}" "${userAgent}"`;
    }

    return `${method} ${url} ${statusCode} ${responseTime} ms - ${contentLength}`;
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

  private getDefaultStream(): { write(chunk: string): unknown } {
    const maybeProcess = globalThis as {
      process?: { stdout?: { write(chunk: string): unknown } };
    };

    if (maybeProcess.process?.stdout?.write) {
      return maybeProcess.process.stdout;
    }

    return {
      write: (chunk: string) => {
        // Use console fallback on runtimes without Node process/stdout.
        // eslint-disable-next-line no-console
        console.log(chunk.trimEnd());
      },
    };
  }
}
