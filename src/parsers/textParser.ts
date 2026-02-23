import type { ContentParser } from "./contentParser";
import { contentTypes } from "./parserInterface";

/**
 * Plain text content parser.
 *
 * Handles `text/plain`, `text/html`, `text/*`, `application/xml`, and similar
 * text-based content types.
 */
export class TextParser implements ContentParser {
  public canParse(contentType: string): boolean {
    return (
      contentType.includes(contentTypes["text-plain"]) ||
      contentType.includes(contentTypes["application-xhtml"])
    );
  }

  public parse(body: Buffer | string): string {
    return Buffer.isBuffer(body) ? body.toString("utf-8") : body;
  }
}
