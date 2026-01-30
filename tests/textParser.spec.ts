import { TextParser } from "../src/parsers";

describe("JsonParserTest", () => {
  let parser: TextParser;

  beforeEach(() => {
    parser = new TextParser();
  });

  it("should valid return true for content type text/, application/xml and application/xhtml", () => {
    expect(parser.canParse("text/plain")).toBe(true);
    expect(parser.canParse("application/xhtml")).toBe(true);
  });

  it("should return false for non-text content types", () => {
    expect(parser.canParse("application/json")).toBe(false);
    expect(parser.canParse("application/xml")).toBe(false);
    expect(parser.canParse("multipart/form-data")).toBe(false);
    expect(parser.canParse("image/png")).toBe(false);
  });

  it("should return string when body is string", async () => {
    const body = "hola mundo";
    const result = await parser.parse(body);

    expect(result).toBe(body);
  });

  it("should convert Buffer to string using utf-8", async () => {
    const body = Buffer.from("Hello buffer", "utf-8");
    const result = await parser.parse(body);

    expect(result).toBe("Hello buffer");
  });

  it("should handle empty string", async () => {
    const result = await parser.parse("");
    expect(result).toBe("");
  });

  it("should handle empty buffer", async () => {
    const result = await parser.parse(Buffer.from(""));
    expect(result).toBe("");
  });
});
