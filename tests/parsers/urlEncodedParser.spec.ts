import { UrlEncodedParser } from "../../src/parsers/urlEncodedParser";

describe("UrlEncodedParserTest", () => {
  let parser: UrlEncodedParser;

  const contentTypesInvalids = new Set<string>([
    "application/json",
    "text/plain",
    "text/html",
    "multipart/form-data",
    "application/xml",
  ]);

  beforeEach(() => {
    parser = new UrlEncodedParser();
  });

  it("should return true for application/x-www-form-urlencoded", () => {
    expect(parser.canParse("application/x-www-form-urlencoded")).toBe(true);

    expect(
      parser.canParse("application/x-www-form-urlencoded; charset=utf-8"),
    ).toBe(true);
  });

  it("should return false for other content types", () => {
    for (const contentType of contentTypesInvalids) {
      expect(parser.canParse(contentType)).toBe(false);
    }
  });

  it("should parse urlencoded string into object", () => {
    const body = "name=Carlos&age=30&role=admin";

    const result = parser.parse(body);

    expect(result).toEqual({
      name: "Carlos",
      age: "30",
      role: "admin",
    });
  });

  it("should parse Buffer into object", () => {
    const body = Buffer.from("q=typescript&level=advanced");

    const result = parser.parse(body);

    expect(result).toEqual({
      q: "typescript",
      level: "advanced",
    });
  });

  it("should decode encoded characters", () => {
    const body = "name=Juan%20P%C3%A9rez&city=Santiago";

    const result = parser.parse(body);

    expect(result).toEqual({
      name: "Juan Pérez",
      city: "Santiago",
    });
  });

  it("should return empty object for empty body", () => {
    const result = parser.parse("");

    expect(result).toEqual({});
  });

  it("should handle single key without value", () => {
    const result = parser.parse("flag");

    expect(result).toEqual({ flag: "" });
  });
});
