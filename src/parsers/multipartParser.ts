import { UnprocessableContentError } from "../exceptions/httpExceptions";
import type { ContentParser } from "./contentParser";
import {
  contentTypes,
  type MultipartData,
  type ParsedPart,
} from "./parserInterface";

/**
 * `multipart/form-data` content parser.
 *
 * Parses multipart payloads into fields and files.
 */
export class MultipartParser implements ContentParser {
  /**
   * Checks whether the given content type is `multipart/form-data`.
   *
   * @param contentType - Raw `Content-Type` header value
   * @returns `true` if the content type is multipart
   */
  public canParse(contentType: string): boolean {
    return contentType.includes(contentTypes["multipart-form-data"]);
  }

  /**
   * Parses a `multipart/form-data` body into a typed structure.
   *
   * @param body - Raw request body
   * @param contentType - Full `Content-Type` header value
   * @returns Parsed multipart data (fields and files)
   * @throws {UnprocessableContentError} If the multipart boundary is missing
   *
   * @example
   * // Typically called through ContentParserManager based on Content-Type:
   * const parsed = parser.parse(body, "multipart/form-data; boundary=---123");
   * // parsed.fields / parsed.files
   */
  public parse(body: Buffer | string, contentType: string): MultipartData {
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
    const boundary = this.extractBoundary(contentType);

    if (!boundary) {
      throw new UnprocessableContentError(
        "Missing boundary in multipart/form-data",
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
      if (part.length === 0 || part.toString().trim() === "--") continue;

      const parsed = this.parsePart(part);
      if (parsed) {
        if (parsed.filename) {
          result.files.push({
            fieldName: parsed.name,
            filename: parsed.filename,
            mimetype:
              parsed.contentType || contentTypes["application-octet-stream"],
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
        parts.push(buffer.subarray(start, pos));
      }
      start = pos + delimiter.length;
    }

    return parts;
  }

  private parsePart(part: Buffer): ParsedPart | null {
    const headerEndIndex = part.indexOf("\r\n\r\n");
    if (headerEndIndex === -1) return null;

    const headerSection = part.subarray(0, headerEndIndex).toString("utf-8");
    const bodySection = part.subarray(headerEndIndex + 4);
    const headers = this.parseHeaders(headerSection);
    const disposition = headers["content-disposition"];

    if (!disposition) return null;

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
