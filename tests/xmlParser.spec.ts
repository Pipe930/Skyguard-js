import { ContentParserException } from "../src/exceptions";
import { XmlParser } from "../src/parsers";

describe("XmlParserTest", () => {
  let parser: XmlParser;

  beforeEach(() => {
    parser = new XmlParser();
  });

  it("should return true for application/xml and text/xml content types", () => {
    expect(parser.canParse("application/xml")).toBe(true);
    expect(parser.canParse("text/xml")).toBe(true);
  });

  it("should reject empty string", () => {
    expect(parser.canParse("")).toBe(false);
  });

  it("should return false for non xml content types", () => {
    expect(parser.canParse("text/html")).toBe(false);
    expect(parser.canParse("application/json")).toBe(false);
    expect(parser.canParse("multipart/form-data")).toBe(false);
    expect(parser.canParse("application/x-www-form-urlencoded")).toBe(false);
  });

  it("should parse valid XML string", async () => {
    const body = "<user><id>1</id><name>Juan</name></user>";
    const result = await parser.parse(body);

    expect(result).toEqual({
      id: "1",
      name: "Juan",
    });
  });

  it("should parse valid XML buffer", async () => {
    const body = Buffer.from("<test><message>HolaMundo</message></test>");
    const result = await parser.parse(body);

    expect(result).toEqual({
      message: "HolaMundo",
    });
  });

  it("should throw ContentParserException on invalid XML", async () => {
    const body = "<message>HolaMundo<message/";

    try {
      await parser.parse(body);
    } catch (err) {
      expect(err).toBeInstanceOf(ContentParserException);
      expect((err as ContentParserException).code).toBe("CONTENT_PARSER_ERROR");
    }
  });
});
