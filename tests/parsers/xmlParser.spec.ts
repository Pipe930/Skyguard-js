import { ContentParserException } from "../../src/exceptions";
import { XmlParser } from "../../src/parsers";

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

  it("should correctly parse a simple xml structure", async () => {
    const xml = `<user><name>Juan</name><age>30</age></user>`;

    const result = await parser.parse(xml);

    expect(result).toEqual({
      user: {
        name: "Juan",
        age: 30,
      },
    });
  });

  it("should properly parse xml with repeated tags as arrays", async () => {
    const xml = `
      <items>
        <item>one</item>
        <item>two</item>
      </items>
    `;

    const result = await parser.parse(xml);

    expect(result).toEqual({
      items: {
        item: ["one", "two"],
      },
    });
  });

  it("should correctly parse boolean and null values", async () => {
    const xml = `
      <data>
        <active>true</active>
        <deleted>false</deleted>
        <value>null</value>
      </data>
    `;

    const result = await parser.parse(xml);

    expect(result).toEqual({
      active: true,
      deleted: false,
      value: null,
    });
  });

  it("should properly decode html entities", async () => {
    const xml = `<message>&lt;hello&gt; &amp; goodbye</message>`;

    const result = await parser.parse(xml);

    expect(result).toEqual({
      message: "<hello> & goodbye",
    });
  });

  it("should correctly unwrap generic root elements", async () => {
    const xml = `
      <data>
        <name>Juan</name>
      </data>
    `;

    const result = await parser.parse(xml);

    expect(result).toEqual({
      name: "Juan",
    });
  });

  it("should properly throw error when xml is empty", async () => {
    await expect(parser.parse("")).rejects.toBeInstanceOf(
      ContentParserException,
    );
  });

  it("should properly throw error when xml structure is invalid", async () => {
    const xml = `name>Juan</name>`;

    await expect(parser.parse(xml)).rejects.toBeInstanceOf(
      ContentParserException,
    );
  });

  it("should properly throw error on mismatched closing tags", async () => {
    const xml = `<user><name>Juan</age></user>`;

    await expect(parser.parse(xml)).rejects.toBeInstanceOf(
      ContentParserException,
    );
  });

  it("should properly throw error on unclosed tags", async () => {
    const xml = `<user><name>Juan</name>`;

    await expect(parser.parse(xml)).rejects.toBeInstanceOf(
      ContentParserException,
    );
  });

  it("should correctly parse xml from buffer input", async () => {
    const xml = Buffer.from(`<user><id>1</id></user>`);

    const result = await parser.parse(xml);

    expect(result).toEqual({
      user: {
        id: 1,
      },
    });
  });
});
