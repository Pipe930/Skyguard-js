import { IncomingMessage } from "node:http";
import {
  ContentParserManager,
  type ContentParser,
  type MultipartData,
} from "../../src/parsers/index";
import { Readable } from "node:stream";

function createMockReq(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
}): IncomingMessage {
  const req = new Readable({
    read() {
      if (options.body) {
        this.push(options.body);
      }
      this.push(null);
    },
  }) as IncomingMessage;

  req.method = options.method ?? "GET";
  req.url = options.url ?? "/";
  req.headers = options.headers ?? {};

  return req;
}

describe("ContentParserManager", () => {
  let manager: ContentParserManager;

  beforeEach(() => {
    manager = new ContentParserManager();
  });

  it("should give priority to last registered parser", async () => {
    class CustomParser implements ContentParser {
      canParse() {
        return true;
      }
      parse() {
        return "custom";
      }
    }

    const req = createMockReq({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify("whatever"),
    });

    manager.registerParser(new CustomParser());

    const result = await manager.parse(req);
    expect(result).toBe("custom");
  });

  it("should use JsonParser for application/json", async () => {
    const req = createMockReq({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ age: 30 }),
    });
    const result = await manager.parse(req);

    expect(result).toEqual({ age: 30 });
  });

  it("should use UrlEncodedParser", async () => {
    const req = createMockReq({
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "name=juan&role=admin",
    });
    const result = await manager.parse(req);

    expect(result).toEqual({
      name: "juan",
      role: "admin",
    });
  });

  it("should use TextParser", async () => {
    const req = createMockReq({
      headers: {
        "content-type": "text/plain",
      },
      body: "hello world",
    });
    const result = await manager.parse(req);

    expect(result).toBe("hello world");
  });

  it("should use MultipartParser", async () => {
    const boundary = "test123";
    const req = createMockReq({
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      body: Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="title"\r\n\r\n` +
          `Post\r\n` +
          `--${boundary}--`,
      ),
    });

    const result = (await manager.parse(req)) as MultipartData;

    expect(result.fields).toEqual({
      title: "Post\r\n",
    });
  });

  it("should use XmlParser", async () => {
    const req = createMockReq({
      headers: {
        "content-type": "application/xml",
      },
      body: `
      <user>
        <id>1</id>
        <name>test</name>
        <age>25</age>
        <active>true</active>
      </user>
      `,
    });

    const result = await manager.parse(req);

    expect(result).toEqual({
      user: {
        id: 1,
        name: "test",
        age: 25,
        active: true,
      },
    });
  });

  it("should return raw buffer if no parser matches", async () => {
    const req = createMockReq({
      headers: {
        "content-type": "application/octet-stream",
      },
      body: "binary-data",
    });

    const result = await manager.parse(req);

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.toString()).toBe("binary-data");
  });

  it("should default contentType to text/plain", async () => {
    const req = createMockReq({
      body: "helloworld",
    });
    const result = await manager.parse(req);

    expect(result).toBe("helloworld");
  });
});
