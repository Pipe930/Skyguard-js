import { ContentParserException } from "../../src/exceptions";
import { MultipartParser } from "../../src/parsers";

describe("MultipartParserTest", () => {
  let parser: MultipartParser;

  const contentTypesInvalids = new Set<string>([
    "application/json",
    "text/plain",
    "text/html",
    "application/x-www-form-urlencoded",
    "application/xml",
  ]);

  beforeEach(() => {
    parser = new MultipartParser();
  });

  it("should return true for multipart/form-data", () => {
    expect(parser.canParse("multipart/form-data; boundary=123")).toBe(true);
  });

  it("should return false for other content types", () => {
    for (const contentType of contentTypesInvalids) {
      expect(parser.canParse(contentType)).toBe(false);
    }
  });

  it("should throw error if boundary is missing", () => {
    const body = "test";

    expect(() => parser.parse(body, "multipart/form-data")).toThrow(
      ContentParserException,
    );
    expect(() => parser.parse(body, "multipart/form-data")).toThrow(
      "Missing boundary in multipart/form-data",
    );
  });

  it("should parse simple fields", () => {
    const boundary = "boundary123";
    const contentType = `multipart/form-data; boundary=${boundary}`;

    const body = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="username"\r\n\r\n` +
        `juan\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="age"\r\n\r\n` +
        `30\r\n` +
        `--${boundary}--`,
    );

    const result = parser.parse(body, contentType);

    expect(result.fields).toEqual({
      username: "juan\r\n",
      age: "30\r\n",
    });

    expect(result.files.length).toBe(0);
  });

  it("should parse file upload", () => {
    const boundary = "boundary123";
    const contentType = `multipart/form-data; boundary=${boundary}`;

    const fileContent = "hello world";

    const body = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="test.txt"\r\n` +
        `Content-Type: text/plain\r\n\r\n` +
        `${fileContent}\r\n` +
        `--${boundary}--`,
    );

    const result = parser.parse(body, contentType);

    expect(result.fields).toEqual({});
    expect(result.files.length).toBe(1);

    const file = result.files[0];

    expect(file.fieldName).toBe("file");
    expect(file.filename).toBe("test.txt");
    expect(file.mimeType).toBe("text/plain");
    expect(file.data.toString("utf-8")).toBe("hello world\r\n");
    expect(file.size).toBe(Buffer.from("hello world\r\n").length);
  });

  it("should parse fields and files together", () => {
    const boundary = "mix123";
    const contentType = `multipart/form-data; boundary=${boundary}`;

    const body = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="title"\r\n\r\n` +
        `My Post\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="image"; filename="img.png"\r\n` +
        `Content-Type: image/png\r\n\r\n` +
        `PNGDATA\r\n` +
        `--${boundary}--`,
    );

    const result = parser.parse(body, contentType);

    expect(result.fields).toEqual({
      title: "My Post\r\n",
    });

    expect(result.files.length).toBe(1);
    expect(result.files[0].filename).toBe("img.png");
    expect(result.files[0].mimeType).toBe("image/png");
  });

  it("should ignore invalid parts", () => {
    const boundary = "invalid123";
    const contentType = `multipart/form-data; boundary=${boundary}`;

    const body = Buffer.from(
      `--${boundary}\r\n` +
        `INVALID HEADER\r\n\r\n` +
        `data\r\n` +
        `--${boundary}--`,
    );

    const result = parser.parse(body, contentType);

    expect(result.fields).toEqual({});
    expect(result.files).toEqual([]);
  });
});
