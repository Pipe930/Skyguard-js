import { ContentParserException } from "../../src/exceptions/contentParserException";
import { XmlParser } from "../../src/parsers/xmlParser";

describe("XmlParserTest", () => {
  let parser: XmlParser;
  const setContentTypesInvalids = new Set<string>([
    "application/json",
    "text/plain",
    "text/html",
    "text/plain",
    "application/x-www-form-urlencoded",
    "multipart/form-data",
  ]);

  beforeEach(() => {
    parser = new XmlParser();
  });

  it("should correctly accept application/xml content type", () => {
    expect(parser.canParse("application/xml")).toBe(true);
    expect(parser.canParse("text/xml")).toBe(true);
  });

  it("should properly reject non xml content type", () => {
    for (const contentType of setContentTypesInvalids) {
      expect(parser.canParse(contentType)).toBe(false);
    }
  });

  it("should correctly parse a simple xml structure", () => {
    const xml = `<user><name>Juan</name><age>30</age></user>`;

    const result = parser.parse(xml);

    expect(result).toEqual({
      user: {
        name: "Juan",
        age: 30,
      },
    });
  });

  it("should properly parse xml with repeated tags as arrays", () => {
    const xml = `
      <items>
        <item>one</item>
        <item>two</item>
      </items>
    `;

    const result = parser.parse(xml);

    expect(result).toEqual({
      items: {
        item: ["one", "two"],
      },
    });
  });

  it("should correctly parse boolean and null values", () => {
    const xml = `
      <data>
        <active>true</active>
        <deleted>false</deleted>
        <value>null</value>
      </data>
    `;

    const result = parser.parse(xml);

    expect(result).toEqual({
      active: true,
      deleted: false,
      value: null,
    });
  });

  it("should properly decode html entities", () => {
    const xml = `<message>&lt;hello&gt; &amp; goodbye</message>`;

    const result = parser.parse(xml);

    expect(result).toEqual({
      message: "<hello> & goodbye",
    });
  });

  it("should correctly unwrap generic root elements", () => {
    const xml = `
      <data>
        <name>Juan</name>
      </data>
    `;

    const result = parser.parse(xml);

    expect(result).toEqual({
      name: "Juan",
    });
  });

  it("should properly throw error when xml is empty", () => {
    expect(() => parser.parse("")).toThrow(ContentParserException);
    expect(() => parser.parse("")).toThrow("XML input is empty");
  });

  it("should properly throw error when xml structure is invalid", () => {
    const xml = `name>Juan</name>`;

    expect(() => parser.parse(xml)).toThrow(ContentParserException);
    expect(() => parser.parse(xml)).toThrow("Invalid XML structure");
  });

  it("should properly throw error on mismatched closing tags", () => {
    const xml = `<user><name>Juan</age></user>`;

    expect(() => parser.parse(xml)).toThrow(ContentParserException);
    expect(() => parser.parse(xml)).toThrow(
      "Unexpected or mismatched closing tag: </age>",
    );
  });

  it("should properly throw error on unclosed tags", () => {
    const xml = `<user><name>Juan</name>`;

    expect(() => parser.parse(xml)).toThrow(ContentParserException);
    expect(() => parser.parse(xml)).toThrow("Unclosed tag: <user>");
  });

  it("should correctly parse xml from buffer input", () => {
    const xml = Buffer.from(`<user><id>1</id></user>`);

    const result = parser.parse(xml);

    expect(result).toEqual({
      user: {
        id: 1,
      },
    });
  });
});
