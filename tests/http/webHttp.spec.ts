import { WebHttpAdapter } from "../../src/http/webHttp";
import { Response } from "../../src/http/response";
import { HttpMethods } from "../../src/http/httpMethods";
import { Readable } from "node:stream";
import { NotImplementedError } from "../../src/exceptions/httpExceptions";

class MemoryStream {
  public chunks: string[] = [];

  public write(chunk: string): void {
    this.chunks.push(chunk);
  }
}

describe("WebHttpAdapter", () => {
  it("builds context from fetch request", async () => {
    const req = new Request("http://localhost/users?page=1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-test": "ok",
      },
      body: JSON.stringify({ name: "John" }),
    });

    const adapter = new WebHttpAdapter(req);
    const context = await adapter.getContext();

    expect(context.req.url).toBe("/users");
    expect(context.req.method).toBe(HttpMethods.post);
    expect(context.req.query["page"]).toBe("1");
    expect(context.req.headers["x-test"]).toBe("ok");
    expect(context.req.body).toEqual({ name: "John" });
  });

  it("throws when trying to send Node readable stream in web runtimes", () => {
    const req = new Request("http://localhost/test");
    const adapter = new WebHttpAdapter(req);
    const stream = Readable.from(["stream-content"]);

    const response = Response.stream(stream);

    expect(() => adapter.sendResponse(response)).toThrow(NotImplementedError);
  });

  it("logs request when sending response", () => {
    const req = new Request("http://localhost/health");
    const stream = new MemoryStream();
    const adapter = new WebHttpAdapter(req, {
      format: "dev",
      stream: stream as unknown as NodeJS.WritableStream,
    });

    adapter.sendResponse(Response.text("ok"));

    expect(stream.chunks).toHaveLength(1);
    expect(stream.chunks[0]).toContain("GET /health");
    expect(stream.chunks[0]).toContain("200");
  });
});
