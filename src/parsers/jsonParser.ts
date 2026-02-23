import { UnprocessableContentError } from "../exceptions/httpExceptions";
import type { ContentParser } from "./contentParser";
import { contentTypes } from "./parserInterface";

/**
 * JSON content parser.
 *
 * Handles `application/json` and `application/*+json` content types.
 */
export class JsonParser implements ContentParser {
  public canParse(contentType: string): boolean {
    return contentType.includes(contentTypes["application-json"]);
  }

  public parse(body: Buffer | string): unknown {
    try {
      const text = Buffer.isBuffer(body) ? body.toString("utf-8") : body;
      return JSON.parse(text);
    } catch {
      throw new UnprocessableContentError("Invalid JSON content");
    }
  }
}
