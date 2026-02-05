import { ContentParser } from "./contentParser";

/**
 * Parser para contenido de texto plano.
 * Maneja: text/plain, text/html, text/*, application/xml, etc.
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
