import { ContentParseError } from "../exceptions";
import { ContentParser } from "./contentParser";
import { MultipartData, ParsedPart } from "./parserInterface";

/**
 * Parser para contenido multipart/form-data.
 * Maneja archivos y campos de formulario.
 */
export class MultipartParser implements ContentParser {
  public canParse(contentType: string): boolean {
    return contentType.includes("multipart/form-data");
  }

  public async parse(
    body: Buffer | string,
    contentType: string,
  ): Promise<MultipartData> {
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
    const boundary = this.extractBoundary(contentType);

    if (!boundary) {
      throw new ContentParseError(
        "Missing boundary in multipart/form-data",
        "MISSING_BOUNDARY",
      );
    }

    return this.parseMultipart(buffer, boundary);
  }

  private extractBoundary(contentType: string): string | null {
    const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    return match ? match[1] || match[2] : null;
  }

  private parseMultipart(buffer: Buffer, boundary: string): MultipartData {
    const result: MultipartData = {
      fields: {},
      files: [],
    };

    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const parts = this.splitBuffer(buffer, boundaryBuffer);

    for (const part of parts) {
      if (part.length === 0 || part.toString().trim() === "--") {
        continue;
      }

      const parsed = this.parsePart(part);
      if (parsed) {
        if (parsed.filename) {
          result.files.push({
            fieldName: parsed.name,
            filename: parsed.filename,
            mimeType: parsed.contentType || "application/octet-stream",
            data: parsed.data,
            size: parsed.data.length,
          });
        } else {
          result.fields[parsed.name] = parsed.data.toString("utf-8");
        }
      }
    }

    return result;
  }

  private splitBuffer(buffer: Buffer, delimiter: Buffer): Buffer[] {
    const parts: Buffer[] = [];
    let start = 0;
    let pos = 0;

    while ((pos = buffer.indexOf(delimiter, start)) !== -1) {
      if (pos > start) {
        parts.push(buffer.slice(start, pos));
      }
      start = pos + delimiter.length;
    }

    return parts;
  }

  private parsePart(part: Buffer): ParsedPart | null {
    // Buscar el separador entre headers y body (\r\n\r\n)
    const headerEndIndex = part.indexOf("\r\n\r\n");
    if (headerEndIndex === -1) return null;

    const headerSection = part.slice(0, headerEndIndex).toString("utf-8");
    const bodySection = part.slice(headerEndIndex + 4);

    // Parsear headers
    const headers = this.parseHeaders(headerSection);
    const disposition = headers["content-disposition"];

    if (!disposition) return null;

    // Extraer name y filename del Content-Disposition
    const nameMatch = disposition.match(/name="([^"]+)"/);
    const filenameMatch = disposition.match(/filename="([^"]+)"/);

    if (!nameMatch) return null;

    return {
      name: nameMatch[1],
      filename: filenameMatch ? filenameMatch[1] : undefined,
      contentType: headers["content-type"],
      data: bodySection,
    };
  }

  private parseHeaders(headerText: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const lines = headerText.split("\r\n");

    for (const line of lines) {
      const colonIndex = line.indexOf(":");
      if (colonIndex !== -1) {
        const key = line.slice(0, colonIndex).trim().toLowerCase();
        const value = line.slice(colonIndex + 1).trim();
        headers[key] = value;
      }
    }

    return headers;
  }
}
