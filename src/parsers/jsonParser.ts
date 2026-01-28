import { ContentParserException } from "../exceptions";
import { ContentParser } from "./contentParser";

/**
 * Parser para contenido JSON.
 * Maneja: application/json, application/*+json
 */
export class JsonParser implements ContentParser {
  public canParse(contentType: string): boolean {
    return (
      contentType.includes("application/json") || contentType.includes("+json")
    );
  }

  public async parse(body: Buffer | string): Promise<unknown> {
    try {
      const text = Buffer.isBuffer(body) ? body.toString("utf-8") : body;
      return JSON.parse(text);
    } catch {
      throw new ContentParserException("Invalid JSON content");
    }
  }
}
