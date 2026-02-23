import { UnprocessableContentError } from "../../src/exceptions/httpExceptions";
import { MultipartParser } from "../../src/parsers/multipartParser";

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
      UnprocessableContentError,
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
      username: "juan",
      age: "30",
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
    expect(file.mimetype).toBe("text/plain");
    expect(file.data.toString("utf-8")).toBe("hello world");
    expect(file.size).toBe(Buffer.from("hello world").length);
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
      title: "My Post",
    });

    expect(result.files.length).toBe(1);
    expect(result.files[0].filename).toBe("img.png");
    expect(result.files[0].mimetype).toBe("image/png");
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

  it("should fail when field size exceeds configured limit", () => {
    const boundary = "limit-field";
    const contentType = `multipart/form-data; boundary=${boundary}`;
    const smallLimitParser = new MultipartParser({ maxFieldSize: 4 });

    const body = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="bio"\r\n\r\n` +
        `toolong\r\n` +
        `--${boundary}--`,
    );

    expect(() => smallLimitParser.parse(body, contentType)).toThrow(
      "Field size limit exceeded: 4 bytes",
    );
  });

  it("should fail when file size exceeds configured limit", () => {
    const boundary = "limit-file";
    const contentType = `multipart/form-data; boundary=${boundary}`;
    const smallLimitParser = new MultipartParser({ maxFileSize: 5 });

    const body = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="a.txt"\r\n` +
        `Content-Type: text/plain\r\n\r\n` +
        `123456\r\n` +
        `--${boundary}--`,
    );

    expect(() => smallLimitParser.parse(body, contentType)).toThrow(
      "File size limit exceeded: 5 bytes",
    );
  });

  it("should fail when parts exceed configured limit", () => {
    const boundary = "limit-parts";
    const contentType = `multipart/form-data; boundary=${boundary}`;
    const smallLimitParser = new MultipartParser({ maxParts: 1 });

    const body = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="a"\r\n\r\n` +
        `1\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="b"\r\n\r\n` +
        `2\r\n` +
        `--${boundary}--`,
    );

    expect(() => smallLimitParser.parse(body, contentType)).toThrow(
      "Multipart parts limit exceeded: 1",
    );
  });
});
