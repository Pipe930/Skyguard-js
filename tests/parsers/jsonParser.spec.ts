import { JsonParser } from "../../src/parsers";
import { ContentParserException } from "../../src/exceptions";

describe("JsonParserTest", () => {
  let parser: JsonParser;

  const contentTypesInvalids = new Set<string>([
    "application/x-www-form-urlencoded",
    "text/plain",
    "text/html",
    "multipart/form-data",
    "application/xml",
  ]);

  beforeEach(() => {
    parser = new JsonParser();
  });

  it("should return true for application/json and custom +json content types", () => {
    expect(parser.canParse("application/json")).toBe(true);
    expect(parser.canParse("application/vnd.api+json")).toBe(true);
  });

  it("should reject empty string", () => {
    expect(parser.canParse("")).toBe(false);
  });

  it("should return false for non json content types", () => {
    for (const contentType of contentTypesInvalids) {
      expect(parser.canParse(contentType)).toBe(false);
    }
  });

  it("should parse valid JSON string", () => {
    const body = '{"name":"Juan","age":30}';

    const result = parser.parse(body);

    expect(result).toEqual({
      name: "Juan",
      age: 30,
    });
  });

  it("should parse valid JSON buffer", () => {
    const body = Buffer.from('{"framework":"Raptor"}');

    const result = parser.parse(body);

    expect(result).toEqual({
      framework: "Raptor",
    });
  });

  it("should throw ContentParserException on invalid JSON and with correct code", () => {
    const body = "{ invalid json";

    try {
      parser.parse(body);
    } catch (err) {
      expect(err).toBeInstanceOf(ContentParserException);
      expect((err as ContentParserException).code).toBe("CONTENT_PARSER_ERROR");
    }
  });
});
