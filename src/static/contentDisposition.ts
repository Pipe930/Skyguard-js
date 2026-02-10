import { ContentDispositionException } from "../exceptions/contentDispositionException";

/** Options for generating `Content-Disposition` values. */
export interface ContentDispositionOptions {
  /**
   * Disposition type.
   * @default "attachment"
   */
  type?: "attachment" | "inline";

  /**
   * Custom ASCII fallback filename.
   *
   * Used for legacy user agents that do not support `filename*`.
   */
  fallback?: string;
}

/**
 * Generates safe `Content-Disposition` values for file downloads.
 *
 * Implements RFC 6266 and RFC 8187 for broad browser compatibility.
 * Prevents header injection and handles non-ASCII filenames correctly.
 *
 * @example
 * const cd = new ContentDisposition();
 *
 * cd.attachment("report.pdf");
 * // => 'attachment; filename="report.pdf"'
 *
 * cd.attachment("reporte año 2024.pdf");
 * // => 'attachment; filename="reporte ano 2024.pdf"; filename*=UTF-8\'\'reporte%20a%C3%B1o%202024.pdf'
 *
 * cd.inline("image.jpg");
 * // => 'inline; filename="image.jpg"'
 */
export class ContentDisposition {
  /**
   * Builds a `Content-Disposition` value for file downloads.
   *
   * @param filename - File name
   * @returns `Content-Disposition` value
   */
  public attachment(filename: string): string {
    return this.create("attachment", filename);
  }

  /**
   * Builds a `Content-Disposition` value for inline rendering.
   *
   * @param filename - File name
   * @returns `Content-Disposition` value
   */
  public inline(filename: string): string {
    return this.create("inline", filename);
  }

  private create(type: "attachment" | "inline", filename: string): string {
    if (!filename || typeof filename !== "string") {
      throw new ContentDispositionException();
    }

    const sanitized = this.sanitizeFilename(filename);
    const needsEncoding = this.needsEncoding(sanitized);
    let disposition = type;

    if (needsEncoding) {
      const fallback = this.createAsciiFallback(sanitized);
      disposition += `; filename="${this.escapeQuotes(fallback)}"`;
      const encoded = this.encodeRFC8187(sanitized);
      disposition += `; filename*=UTF-8''${encoded}`;
    } else {
      disposition += `; filename="${this.escapeQuotes(sanitized)}"`;
    }

    return disposition;
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
      .replace(/["\r\n]/g, "")
      .replace(/[/\\]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private needsEncoding(filename: string): boolean {
    return /[^\x20-\x7E]/.test(filename);
  }

  private createAsciiFallback(filename: string): string {
    const charMap: Record<string, string> = {
      á: "a",
      é: "e",
      í: "i",
      ó: "o",
      ú: "u",
      ñ: "n",
      Á: "A",
      É: "E",
      Í: "I",
      Ó: "O",
      Ú: "U",
      Ñ: "N",
      ü: "u",
      Ü: "U",
      ç: "c",
      Ç: "C",
      ß: "ss",
      æ: "ae",
      œ: "oe",
      " ": " ",
    };

    let result = filename;

    for (const [char, replacement] of Object.entries(charMap)) {
      result = result.replace(new RegExp(char, "g"), replacement);
    }

    result = result.replace(/[^\x20-\x7E]/g, "");
    return result;
  }

  private escapeQuotes(filename: string): string {
    return filename.replace(/"/g, '\\"');
  }

  private encodeRFC8187(filename: string): string {
    const attrChar = /[a-zA-Z0-9!#$&+.^_`|~-]/;
    let encoded = "";

    for (let i = 0; i < filename.length; i++) {
      const char = filename[i];

      if (attrChar.test(char)) {
        encoded += char;
      } else {
        const bytes = Buffer.from(char, "utf-8");
        for (const byte of bytes) {
          encoded += "%" + byte.toString(16).toUpperCase().padStart(2, "0");
        }
      }
    }

    return encoded;
  }

  /**
   * Parses an existing `Content-Disposition` header value.
   *
   * Supports both `filename=` and `filename*=` (RFC 8187).
   *
   * @param header - Raw `Content-Disposition` header value
   * @returns Parsed disposition type and filename (if present)
   *
   * @example
   * const cd = new ContentDisposition();
   * cd.parse('attachment; filename="report.pdf"');
   * // => { type: "attachment", filename: "report.pdf" }
   */
  public parse(header: string): { type: string; filename: string | null } {
    const parts = header.split(";").map((p) => p.trim());
    const type = parts[0];

    let filename: string | null = null;

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];

      if (part.startsWith("filename*=")) {
        const value = part.substring(10);
        const match = value.match(/^UTF-8''(.+)$/i);
        if (match) {
          filename = decodeURIComponent(match[1]);
          break;
        }
      }

      if (part.startsWith("filename=") && !filename) {
        let value = part.substring(9);
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }

        filename = value.replace(/\\"/g, '"');
      }
    }

    return { type, filename };
  }
}
