import { IncomingMessage } from "node:http";
import { Response } from "./response";

export class Logger {
  private stream: NodeJS.WritableStream;

  constructor() {
    this.stream = process.stdout;
  }

  public log(req: IncomingMessage, res: Response, startTime: bigint): void {
    const method = req.method || "-";
    const url = req.url || "-";
    const contentLength = res.getHeaders["content-length"] || "-";

    const diff = process.hrtime.bigint() - startTime;
    const responseTime = (Number(diff) / 1_000_000).toFixed(3);
    const coloredStatus = this.colorizeStatus(res.getStatus);
    const logLine = `${method} ${url} ${coloredStatus} ${responseTime} ms - ${contentLength}`;

    this.stream.write(logLine + "\n");
  }

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
