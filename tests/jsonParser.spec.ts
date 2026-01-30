import { JsonParser } from "../src/parsers";
import { ContentParserException } from "../src/exceptions";

describe("JsonParserTest", () => {
  let parser: JsonParser;

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
    expect(parser.canParse("text/html")).toBe(false);
    expect(parser.canParse("application/xml")).toBe(false);
    expect(parser.canParse("multipart/form-data")).toBe(false);
    expect(parser.canParse("application/x-www-form-urlencoded")).toBe(false);
  });

  it("should parse valid JSON string", async () => {
    const body = '{"name":"Juan","age":30}';

    const result = await parser.parse(body);

    expect(result).toEqual({
      name: "Juan",
      age: 30,
    });
  });

  it("should parse valid JSON buffer", async () => {
    const body = Buffer.from('{"framework":"Raptor"}');

    const result = await parser.parse(body);

    expect(result).toEqual({
      framework: "Raptor",
    });
  });

  it("should throw ContentParserException on invalid JSON and with correct code", async () => {
    const body = "{ invalid json";

    try {
      await parser.parse(body);
    } catch (err) {
      expect(err).toBeInstanceOf(ContentParserException);
      expect((err as ContentParserException).code).toBe("CONTENT_PARSER_ERROR");
    }
  });
});
