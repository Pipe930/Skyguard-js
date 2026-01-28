import { MultipartParser } from "../src/parsers";
import { ContentParserException } from "../src/exceptions";

describe("MultipartParser", () => {
  let parser: MultipartParser;

  beforeEach(() => {
    parser = new MultipartParser();
  });

  it("should return true for multipart/form-data", () => {
    expect(parser.canParse("multipart/form-data; boundary=123")).toBe(true);
  });

  it("should return false for other content types", () => {
    expect(parser.canParse("application/json")).toBe(false);
    expect(parser.canParse("text/plain")).toBe(false);
  });

  it("should throw error if boundary is missing", async () => {
    const body = "test";

    await expect(
      parser.parse(body, "multipart/form-data"),
    ).rejects.toBeInstanceOf(ContentParserException);
  });

  it("should parse simple fields", async () => {
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

    const result = await parser.parse(body, contentType);

    expect(result.fields).toEqual({
      username: "juan\r\n",
      age: "30\r\n",
    });

    expect(result.files.length).toBe(0);
  });

  it("should parse file upload", async () => {
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

    const result = await parser.parse(body, contentType);

    expect(result.fields).toEqual({});
    expect(result.files.length).toBe(1);

    const file = result.files[0];

    expect(file.fieldName).toBe("file");
    expect(file.filename).toBe("test.txt");
    expect(file.mimeType).toBe("text/plain");
    expect(file.data.toString("utf-8")).toBe("hello world\r\n");
    expect(file.size).toBe(Buffer.from("hello world\r\n").length);
  });

  it("should parse fields and files together", async () => {
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

    const result = await parser.parse(body, contentType);

    expect(result.fields).toEqual({
      title: "My Post\r\n",
    });

    expect(result.files.length).toBe(1);
    expect(result.files[0].filename).toBe("img.png");
    expect(result.files[0].mimeType).toBe("image/png");
  });

  it("should ignore invalid parts", async () => {
    const boundary = "invalid123";
    const contentType = `multipart/form-data; boundary=${boundary}`;

    const body = Buffer.from(
      `--${boundary}\r\n` +
        `INVALID HEADER\r\n\r\n` +
        `data\r\n` +
        `--${boundary}--`,
    );

    const result = await parser.parse(body, contentType);

    expect(result.fields).toEqual({});
    expect(result.files).toEqual([]);
  });
});
