import { describe, expect, test } from "@jest/globals";
import { Logger, type LogFormat } from "../../src/http/logger";
import type { IncomingMessage, ServerResponse } from "node:http";

class MemoryStream {
  public chunks: string[] = [];

  public write(chunk: string): void {
    this.chunks.push(chunk);
  }
}

const buildRequest = (): IncomingMessage => {
  return {
    method: "GET",
    url: "/api/users",
    httpVersion: "1.1",
    headers: {
      "user-agent": "jest-agent",
      referer: "http://localhost/source",
    },
    socket: {
      remoteAddress: "localhost",
    },
  } as IncomingMessage;
};

const buildResponse = (): ServerResponse => {
  return {
    statusCode: 200,
    getHeader: (name: string) => {
      if (name.toLowerCase() === "content-length") return "321";
      return undefined;
    },
  } as ServerResponse;
};

describe("Logger Test", () => {
  test.each<LogFormat>(["combined", "common", "dev", "short", "tiny"])(
    "logs using %s format",
    format => {
      const stream = new MemoryStream();
      const logger = new Logger({
        format,
        stream: stream as unknown as NodeJS.WritableStream,
      });

      logger.log(buildRequest(), buildResponse(), process.hrtime.bigint());

      expect(stream.chunks).toHaveLength(1);
      expect(stream.chunks[0]).toContain("GET /api/users");
      expect(stream.chunks[0]).toContain("200");
    },
  );

  test("writes uncolored output to file stream", () => {
    const stream = new MemoryStream();
    const fileStream = new MemoryStream();

    const logger = new Logger({
      format: "dev",
      stream: stream as unknown as NodeJS.WritableStream,
      fileStream: fileStream as unknown as NodeJS.WritableStream,
    });

    logger.log(buildRequest(), buildResponse(), process.hrtime.bigint());

    const greenStatus = "\u001b[32m200\u001b[0m";

    expect(stream.chunks[0]).toContain(greenStatus);
    expect(fileStream.chunks[0]).not.toContain(greenStatus);
  });
});
