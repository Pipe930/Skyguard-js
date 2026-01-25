import { ContentParser } from "./contentParser";

/**
 * Parser para contenido URL-encoded.
 * Maneja: application/x-www-form-urlencoded
 */
export class UrlEncodedParser implements ContentParser {
  public canParse(contentType: string): boolean {
    return contentType.includes("application/x-www-form-urlencoded");
  }

  public async parse(body: Buffer | string): Promise<Record<string, string>> {
    const text = Buffer.isBuffer(body) ? body.toString("utf-8") : body;
    const params = new URLSearchParams(text);
    return Object.fromEntries(params.entries());
  }
}
