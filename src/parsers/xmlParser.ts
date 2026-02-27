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

  /**
   * Validates that XML tags are balanced and correctly nested.
   *
   * This is a lightweight well-formedness check:
   * - Every closing tag must match the most recent unmatched opening tag.
   * - At the end, no unclosed tags may remain.
   *
   * Notes / limitations:
   * - Self-closing tags (e.g. `<tag/>`) are treated as opening tags by this
   *   simplified regex and may cause false positives depending on input.
   *   (Your parser later supports self-closing tags during content parsing,
   *   but the balanced-tag validator is intentionally minimal.)
   *
   * @param xml - XML string (without declaration/comments).
   * @throws {UnprocessableContentError} If tags are mismatched or unclosed.
   */
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

  /**
   * Parses the root element and normalizes the return shape.
   *
   * Steps:
   * - Ensures the input contains a single root element: `<root>...</root>`.
   * - Parses the root inner content using {@link parseContent}.
   * - For "generic" root names (e.g. `<root>`, `<data>`), returns the parsed
   *   content directly when it is an object, to avoid an extra nesting layer.
   *
   * @param xml - Full XML string expected to contain a single root element.
   * @returns Parsed object representation.
   * @throws {UnprocessableContentError} If the root element is invalid.
   */
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

  /**
   * Parses the content inside an XML element.
   *
   * Behavior:
   * - If the content has no nested tags, it is treated as a text node and
   *   parsed via {@link parseValue}.
   * - If the content contains nested elements, it extracts child elements and
   *   builds an object:
   *   - Each child tag becomes a property.
   *   - Repeated child tags become arrays.
   *   - Self-closing tags become `null`.
   *
   * If no child tags are found but the content still contains `<`, it falls
   * back to parsing as a primitive value (best-effort).
   *
   * @param content - Raw inner XML (no surrounding root tag).
   * @returns Parsed representation (object, array via repetition, primitive, or null).
   */
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

  /**
   * Inserts a parsed value into the result object, supporting repeated tags.
   *
   * - If the key does not exist, it sets `result[key] = value`.
   * - If the key already exists:
   *   - If it is already an array, it pushes the new value.
   *   - Otherwise, it converts the existing value into an array and appends
   *     the new value.
   *
   * This allows representing XML like:
   * `<a>1</a><a>2</a>` as `{ a: [1, 2] }`.
   *
   * @param result - Target object being built.
   * @param key - Tag name to assign.
   * @param value - Parsed value for that tag.
   */
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

  /**
   * Parses a text node value into a JavaScript primitive when possible.
   *
   * Coercions:
   * - `"true"`  -> `true`
   * - `"false"` -> `false`
   * - `"null"` or empty string -> `null`
   * - numeric strings -> `number`
   *
   * If none match, it returns the string after decoding common HTML entities.
   *
   * @param value - Raw text content.
   * @returns Parsed primitive value or decoded string.
   */
  private parseValue(value: string): unknown {
    const trimmed = value.trim();

    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null" || trimmed === "") return null;
    if (!isNaN(Number(trimmed)) && trimmed !== "") return Number(trimmed);

    return this.decodeHtmlEntities(trimmed);
  }

  /**
   * Decodes a small subset of XML/HTML entities in text nodes.
   *
   * Supported entities:
   * - `&lt;`   -> `<`
   * - `&gt;`   -> `>`
   * - `&amp;`  -> `&`
   * - `&quot;` -> `"`
   * - `&apos;` -> `'`
   *
   * @param text - Text containing entity references.
   * @returns Decoded string.
   */
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
