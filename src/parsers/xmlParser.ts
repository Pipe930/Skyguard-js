import { ContentParserException } from "../exceptions";
import { ContentParser } from "./contentParser";

/**
 * Parser para contenido XML
 * Maneja: text/xml y application/xml.
 */
export class XmlParser implements ContentParser {
  public canParse(contentType: string): boolean {
    return (
      contentType.includes("application/xml") ||
      contentType.includes("text/xml")
    );
  }

  public async parse(input: string | Buffer): Promise<Record<string, string>> {
    const text = Buffer.isBuffer(input) ? input.toString("utf-8") : input;

    const result: Record<string, string> = {};

    const cleanXml = text.replace(/<\?xml[^?]*\?>/g, "").trim();

    if (!cleanXml.startsWith("<") || !cleanXml.endsWith(">"))
      throw new ContentParserException("Invalid XML format");

    // Regex básico para tags simples: <key>value</key>
    const tagRegex = /<(\w+)>([^<]+)<\/\1>/g;
    let match: RegExpExecArray;

    while ((match = tagRegex.exec(text)) !== null) {
      const [, key, value] = match;
      result[key] = value.trim();
    }

    return result;
  }
}
