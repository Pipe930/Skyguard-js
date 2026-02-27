import { UnprocessableContentError } from "../exceptions/httpExceptions";
import type { ContentParser } from "./contentParser";
import type { MultipartData, ParsedPart } from "./parserInterface";

/**
 * `multipart/form-data` content parser.
 *
 * Parses multipart payloads into fields and files.
 */
export class MultipartParser implements ContentParser {
  private readonly maxParts: number;
  private readonly maxFieldSize: number;
  private readonly maxFileSize: number;
  private readonly maxHeaderSize: number;

  constructor(
    options: {
      maxParts?: number;
      maxFieldSize?: number;
      maxFileSize?: number;
      maxHeaderSize?: number;
    } = {},
  ) {
    this.maxParts = options.maxParts ?? 1000;
    this.maxFieldSize = options.maxFieldSize ?? 1024 * 1024; // 1MB
    this.maxFileSize = options.maxFileSize ?? 10 * 1024 * 1024; // 10MB
    this.maxHeaderSize = options.maxHeaderSize ?? 16 * 1024; // 16KB
  }

  /**
   * Checks whether the given content type is `multipart/form-data`.
   *
   * @param contentType - Raw `Content-Type` header value
   * @returns `true` if the content type is multipart
   */
  public canParse(contentType: string): boolean {
    return contentType.includes("multipart/form-data");
  }

  /**
   * Parses a `multipart/form-data` body into a typed structure.
   *
   * @param body - Raw request body
   * @param contentType - Full `Content-Type` header value
   * @returns Parsed multipart data (fields and files)
   * @throws {UnprocessableContentError} If the multipart boundary is missing
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

  /**
   * Extracts the `boundary` parameter from a `Content-Type` header value.
   *
   * Supports both quoted and unquoted forms:
   * - `multipart/form-data; boundary=abc123`
   * - `multipart/form-data; boundary="abc123"`
   *
   * @param contentType - Raw `Content-Type` header value.
   * @returns The boundary string, or `null` if not present.
   */
  private extractBoundary(contentType: string): string | null {
    const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    return match ? match[1] || match[2] : null;
  }

  /**
   * Parses the complete multipart payload using the provided boundary.
   *
   * This method:
   * - Splits the raw buffer into boundary-delimited parts
   * - Skips empty / closing boundary chunks
   * - Parses each part into headers + body data
   * - Routes parts into either `fields` (text) or `files` (binary/file parts)
   * - Enforces limits for:
   *   - total number of parts (`maxParts`)
   *   - single field size (`maxFieldSize`)
   *   - single file size (`maxFileSize`)
   *
   * @param buffer - Full request body as a Buffer.
   * @param boundary - Multipart boundary token (without the leading `--`).
   * @returns Parsed `MultipartData`.
   * @throws {UnprocessableContentError} If limits are exceeded.
   */
  private parseMultipart(buffer: Buffer, boundary: string): MultipartData {
    const result: MultipartData = {
      fields: {},
      files: [],
    };

    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const parts = this.splitBuffer(buffer, boundaryBuffer);

    if (parts.length > this.maxParts) {
      throw new UnprocessableContentError(
        `Multipart parts limit exceeded: ${this.maxParts}`,
      );
    }

    for (const part of parts) {
      if (part.length === 0 || part.toString().trim() === "--") continue;

      const parsed = this.parsePart(part);
      if (!parsed) continue;
      const size = parsed.data.length;

      if (parsed.filename) {
        if (size > this.maxFileSize) {
          throw new UnprocessableContentError(
            `File size limit exceeded: ${this.maxFileSize} bytes`,
          );
        }

        result.files.push({
          fieldName: parsed.name,
          filename: parsed.filename,
          mimetype: parsed.contentType ?? "application/octet-stream",
          data: parsed.data,
          size,
        });

        continue;
      }

      if (size > this.maxFieldSize) {
        throw new UnprocessableContentError(
          `Field size limit exceeded: ${this.maxFieldSize} bytes`,
        );
      }

      result.fields[parsed.name] = parsed.data.toString("utf-8");
    }

    return result;
  }

  /**
   * Splits a Buffer by a delimiter Buffer (non-regex, byte-level splitting).
   *
   * Notes:
   * - The returned buffers are slices of the original buffer (via `subarray`),
   *   so they are cheap and do not copy data.
   * - The delimiter itself is not included in the returned parts.
   *
   * @param buffer - Source buffer to split.
   * @param delimiter - Delimiter marker (e.g. `--boundary`).
   * @returns Array of buffer parts between delimiter occurrences.
   */
  private splitBuffer(buffer: Buffer, delimiter: Buffer): Buffer[] {
    const parts: Buffer[] = [];
    let start = 0;
    let pos: number;

    while ((pos = buffer.indexOf(delimiter, start)) !== -1) {
      if (pos > start) {
        parts.push(buffer.subarray(start, pos));
      }
      start = pos + delimiter.length;
    }

    return parts;
  }

  /**
   * Parses a single multipart part into a structured object.
   *
   * A valid part looks like:
   * - headers (ASCII/UTF-8)
   * - blank line (`\r\n\r\n`)
   * - body bytes
   *
   * This method:
   * - Locates the header/body separator
   * - Enforces maximum header section size (`maxHeaderSize`)
   * - Parses headers into a normalized map
   * - Reads `Content-Disposition` to extract:
   *   - `name="..."` (required)
   *   - `filename="..."` (optional, indicates file upload)
   * - Trims a trailing CRLF from the body section (common multipart formatting)
   *
   * @param part - Raw part buffer (excluding the boundary marker).
   * @returns Parsed part info, or `null` if the part is malformed / missing required metadata.
   * @throws {UnprocessableContentError} If the header section exceeds `maxHeaderSize`.
   */
  private parsePart(part: Buffer): ParsedPart | null {
    const headerEndIndex = part.indexOf("\r\n\r\n");
    if (headerEndIndex === -1) return null;

    if (headerEndIndex > this.maxHeaderSize) {
      throw new UnprocessableContentError(
        `Multipart headers too large: ${this.maxHeaderSize} bytes`,
      );
    }

    const headerSection = part.subarray(0, headerEndIndex).toString("utf-8");
    const bodySection = this.trimEndingCRLF(part.subarray(headerEndIndex + 4));
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

  /**
   * Parses a multipart header block into a key/value map.
   *
   * Header names are normalized to lower-case for case-insensitive matching.
   * Only lines containing `:` are considered header lines.
   *
   * Example input:
   * ```
   * Content-Disposition: form-data; name="file"; filename="a.txt"
   * Content-Type: text/plain
   * ```
   *
   * @param headerText - Raw header block as a string (no trailing blank line).
   * @returns Object map of headers with lower-case keys.
   */
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

    /**
   * Removes a trailing CRLF (`\r\n`) from a buffer if present.
   *
   * Multipart bodies commonly end each part with an extra CRLF before the next
   * boundary marker. Trimming it avoids including that delimiter in field/file data.
   *
   * @param data - Part body buffer.
   * @returns Buffer without the final CRLF if it existed, otherwise the original buffer.
   */
  private trimEndingCRLF(data: Buffer): Buffer {
    if (data.length < 2) return data;

    const end = data.subarray(-2).toString("utf-8");
    if (end === "\r\n") return data.subarray(0, data.length - 2);

    return data;
  }
}
