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

  /**
   * Creates a `Content-Disposition` header value with a sanitized filename.
   *
   * If the filename contains non-ASCII characters, the value includes:
   * - `filename="..."` as an ASCII fallback (quoted-string)
   * - `filename*=UTF-8''...` using RFC 8187 percent-encoding
   *
   * This mirrors common browser-compatible behavior for international filenames.
   *
   * @param type - Disposition type (`attachment` or `inline`).
   * @param filename - Original file name provided by the caller.
   * @returns Fully formatted `Content-Disposition` header value.
   * @throws ContentDispositionException if `filename` is missing or not a string.
   */
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

  /**
   * Sanitizes a filename for safe inclusion in HTTP headers.
   *
   * This method:
   * - Removes ASCII control characters (0x00–0x1F) and C1 controls (0x7F–0x9F)
   * - Strips double quotes and CR/LF to prevent header injection
   * - Removes path separators (`/` and `\`) to prevent path-like values
   * - Collapses consecutive whitespace into single spaces and trims edges
   *
   * @param filename - Raw file name input.
   * @returns A sanitized filename safe to embed in `Content-Disposition`.
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .split("")
      .filter(char => {
        const code = char.charCodeAt(0);
        return !(code <= 0x1f || (code >= 0x7f && code <= 0x9f));
      })
      .join("")
      .replace(/["\r\n]/g, "")
      .replace(/[/\\]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Checks whether a filename contains non-ASCII characters.
   *
   * If true, the value should include an RFC 8187 `filename*=` parameter
   * for correct UTF-8 handling across clients.
   *
   * @param filename - Sanitized filename.
   * @returns `true` if the filename contains characters outside the visible ASCII range.
   */
  private needsEncoding(filename: string): boolean {
    return /[^\x20-\x7E]/.test(filename);
  }

  /**
   * Creates an ASCII-only fallback filename.
   *
   * Some clients do not support RFC 8187 (`filename*=`). In those cases,
   * providing a conservative ASCII `filename="..."` improves compatibility.
   *
   * The algorithm:
   * - Performs a small transliteration for common Latin characters
   * - Removes any remaining non-ASCII characters
   *
   * @param filename - Sanitized filename that may contain non-ASCII characters.
   * @returns An ASCII-only fallback filename.
   */
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

  /**
   * Escapes double quotes for inclusion inside a quoted-string parameter.
   *
   * Example:
   * - `my"file.txt` -> `my\"file.txt`
   *
   * @param filename - Filename to escape.
   * @returns Escaped string safe for `filename="..."`.
   */
  private escapeQuotes(filename: string): string {
    return filename.replace(/"/g, '\\"');
  }

  /**
   * Encodes a string for RFC 8187 `filename*=` parameters.
   *
   * RFC 8187 uses:
   * - UTF-8 byte encoding
   * - Percent-encoding for bytes outside the allowed attribute-char set
   *
   * This method percent-encodes any character that is not an `attr-char`
   * as defined by the RFC.
   *
   * @param filename - UTF-8 filename to encode.
   * @returns RFC 8187 percent-encoded string (without the `UTF-8''` prefix).
   */
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
   * Supports both:
   * - `filename="..."` (quoted-string, with `\"` unescaping)
   * - `filename*=UTF-8''...` (RFC 8187 encoded form, decoded via `decodeURIComponent`)
   *
   * If both are present, `filename*=` takes precedence.
   *
   * @param header - Raw `Content-Disposition` header value (e.g. `"attachment; filename=\"a.txt\""`).
   * @returns An object containing:
   * - `type`: the disposition type (e.g. `"attachment"` or `"inline"`)
   * - `filename`: the extracted filename, or `null` if none is present
   */
  public parse(header: string): { type: string; filename: string | null } {
    const parts = header.split(";").map(p => p.trim());
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
