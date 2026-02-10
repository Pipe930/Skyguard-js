import type { ContentParser } from "./contentParser";

/**
 * Plain text content parser.
 *
 * Handles `text/plain`, `text/html`, `text/*`, `application/xml`, and similar
 * text-based content types.
 */
export class TextParser implements ContentParser {
  public canParse(contentType: string): boolean {
    return (
      contentType.includes("text/plain") ||
      contentType.includes("application/xhtml")
    );
  }

  public parse(body: Buffer | string): string {
    return Buffer.isBuffer(body) ? body.toString("utf-8") : body;
  }
}
