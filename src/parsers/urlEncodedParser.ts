import type { ContentParser } from "./contentParser";
import { contentTypes } from "./parserInterface";

/**
 * URL-encoded form content parser.
 *
 * Handles `application/x-www-form-urlencoded` content types.
 */
export class UrlEncodedParser implements ContentParser {
  public canParse(contentType: string): boolean {
    return contentType.includes(
      contentTypes["application-x-www-form-urlencoded"],
    );
  }

  public parse(body: Buffer | string): Record<string, string> {
    const text = Buffer.isBuffer(body) ? body.toString("utf-8") : body;
    const params = new URLSearchParams(text);
    return Object.fromEntries(params.entries());
  }
}
