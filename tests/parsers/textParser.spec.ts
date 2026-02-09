import { TextParser } from "@parsers/textParser";

describe("TextParserTest", () => {
  let parser: TextParser;

  const contentTypesInvalids = new Set<string>([
    "application/x-www-form-urlencoded",
    "application/json",
    "text/html",
    "multipart/form-data",
    "application/xml",
  ]);

  beforeEach(() => {
    parser = new TextParser();
  });

  it("should valid return true for content type text/plain and application/xhtml", () => {
    expect(parser.canParse("text/plain")).toBe(true);
    expect(parser.canParse("application/xhtml")).toBe(true);
  });

  it("should return false for non-text content types", () => {
    for (const contentType of contentTypesInvalids) {
      expect(parser.canParse(contentType)).toBe(false);
    }
  });

  it("should return string when body is string", () => {
    const body = "hola mundo";
    const result = parser.parse(body);

    expect(result).toBe(body);
  });

  it("should convert Buffer to string using utf-8", () => {
    const body = Buffer.from("Hello buffer", "utf-8");
    const result = parser.parse(body);

    expect(result).toBe("Hello buffer");
  });

  it("should handle empty string", () => {
    const result = parser.parse("");
    expect(result).toBe("");
  });

  it("should handle empty buffer", () => {
    const result = parser.parse(Buffer.from(""));
    expect(result).toBe("");
  });
});
