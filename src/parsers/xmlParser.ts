import { UnprocessableContentError } from "../exceptions/httpExceptions";
import type { ContentParser } from "./contentParser";

/**
 * XML content parser.
 *
 * Lightweight and safe XML parsing intended for HTTP request bodies.
 * It is designed for simple, well-formed XML and does not aim to replace
 * a full-featured XML parser.
 *
 * Limitations:
 * - No attributes
 * - No namespaces
 * - No CDATA
 * - No DTD/Schema validation
 * - No mixed content (text + child nodes)
 *
 * Features:
 * - Supports `application/xml` and `text/xml`
 * - Validates balanced tags
 * - Converts repeated tags into arrays
 * - Basic primitive casting (number, boolean, null)
 * - Decodes common XML/HTML entities
 */
export class XmlParser implements ContentParser {
  /**
   * Checks whether the given content type is XML.
   *
   * @param contentType - Raw `Content-Type` header value
   * @returns `true` if the content type is XML
   */
  public canParse(contentType: string): boolean {
    return (
      contentType.includes("application/xml") ||
      contentType.includes("text/xml")
    );
  }

  /**
   * Parses XML input and converts it into a JavaScript object.
   *
   * @param input - Raw XML content
   * @returns Parsed object representation of the XML
   *
   * @throws {UnprocessableContentError}
   * Thrown when the XML is empty, malformed, or has unbalanced tags.
   */
  public parse(input: string | Buffer): Record<string, unknown> {
    const text = Buffer.isBuffer(input) ? input.toString("utf-8") : input;

    if (!text || text.trim().length === 0)
      throw new UnprocessableContentError("XML input is empty");

    const cleanXml = text
      .replace(/<\?xml[^?]*\?>/g, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .trim();

    if (!cleanXml.startsWith("<") || !cleanXml.endsWith(">"))
      throw new UnprocessableContentError("Invalid XML structure");

    this.validateBalancedTags(cleanXml);

    return this.parseXmlContent(cleanXml);
  }

  private validateBalancedTags(xml: string): void {
    const stack: string[] = [];
    const tagRegex = /<\/?(\w+)[^>]*>/g;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(xml)) !== null) {
      const fullTag = match[0];
      const tagName = match[1];

      if (fullTag.startsWith("</")) {
        if (stack.length === 0 || stack.pop() !== tagName)
          throw new UnprocessableContentError(
            `Unexpected or mismatched closing tag: </${tagName}>`,
          );
      } else {
        stack.push(tagName);
      }
    }

    if (stack.length > 0)
      throw new UnprocessableContentError(
        `Unclosed tag: <${stack[stack.length - 1]}>`,
      );
  }

  private parseXmlContent(xml: string): Record<string, unknown> {
    const rootMatch = xml.match(/^<(\w+)[^>]*>([\s\S]*)<\/\1>$/);

    if (!rootMatch)
      throw new UnprocessableContentError("Invalid XML root element");

    const [, rootTag, content] = rootMatch;
    const parsed = this.parseContent(content);

    const genericRoots = ["root", "data", "xml", "response", "request"];
    if (genericRoots.includes(rootTag.toLowerCase())) {
      return typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : { [rootTag]: parsed };
    }

    return { [rootTag]: parsed };
  }

  private parseContent(content: string): unknown {
    const trimmed = content.trim();

    if (!trimmed) return null;
    if (!trimmed.includes("<")) return this.parseValue(trimmed);

    const result: Record<string, unknown> = {};
    const tagRegex = /<(\w+)[^>]*>([\s\S]*?)<\/\1>|<(\w+)[^>]*\/>/g;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(content)) !== null) {
      if (match[1]) {
        const tagName = match[1];
        const tagContent = match[2];

        const value = this.parseContent(tagContent);
        this.addValueToResult(result, tagName, value);
      } else if (match[3]) {
        this.addValueToResult(result, match[3], null);
      }
    }

    if (Object.keys(result).length === 0) return this.parseValue(trimmed);

    return result;
  }

  private addValueToResult(
    result: Record<string, unknown>,
    key: string,
    value: unknown,
  ): void {
    if (key in result) {
      if (Array.isArray(result[key])) {
        (result[key] as unknown[]).push(value);
      } else {
        result[key] = [result[key], value];
      }
    } else {
      result[key] = value;
    }
  }

  private parseValue(value: string): unknown {
    const trimmed = value.trim();

    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null" || trimmed === "") return null;
    if (!isNaN(Number(trimmed)) && trimmed !== "") return Number(trimmed);

    return this.decodeHtmlEntities(trimmed);
  }

  private decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      "&lt;": "<",
      "&gt;": ">",
      "&amp;": "&",
      "&quot;": '"',
      "&apos;": "'",
    };

    return text.replace(/&(lt|gt|amp|quot|apos);/g, match => {
      return entities[match] || match;
    });
  }
}
