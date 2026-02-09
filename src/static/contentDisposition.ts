import { ContentDispositionException } from "@exceptions/contentDispositionException";

/**
 * Opciones para la generación de Content-Disposition
 */
export interface ContentDispositionOptions {
  /**
   * Tipo de disposición
   * @default 'attachment'
   */
  type?: "attachment" | "inline";

  /**
   * Fallback ASCII personalizado
   */
  fallback?: string;
}

/**
 * Genera headers Content-Disposition seguros para descargas de archivos
 *
 * Implementa RFC 6266 y RFC 8187 para máxima compatibilidad entre navegadores
 * Previene inyección de headers y maneja correctamente caracteres especiales
 */
export class ContentDisposition {
  /**
   * Genera un header Content-Disposition para descarga de archivo
   *
   * @param filename - Nombre del archivo
   * @returns String del header Content-Disposition
   *
   * @example
   * ContentDisposition.attachment('report.pdf');
   * // => 'attachment; filename="report.pdf"'
   *
   * @example
   * ContentDisposition.attachment('reporte año 2024.pdf');
   * // => 'attachment; filename="reporte ano 2024.pdf"; filename*=UTF-8\'\'reporte%20a%C3%B1o%202024.pdf'
   *
   * @example
   * ContentDisposition.inline('image.jpg');
   * // => 'inline; filename="image.jpg"'
   */
  public attachment(filename: string): string {
    return this.create("attachment", filename);
  }

  /**
   * Genera un header Content-Disposition para mostrar inline
   *
   * @param filename - Nombre del archivo
   * @returns String del header Content-Disposition
   */
  public inline(filename: string): string {
    return this.create("inline", filename);
  }

  /**
   * Crea el header Content-Disposition
   *
   * @param type - Tipo de disposición ('attachment' o 'inline')
   * @param filename - Nombre del archivo
   * @param options - Opciones adicionales
   * @returns Header completo
   */
  private create(type: "attachment" | "inline", filename: string): string {
    if (!filename || typeof filename !== "string")
      throw new ContentDispositionException();

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
   * Sanitiza el nombre del archivo removiendo caracteres peligrosos
   *
   * Previene inyección de headers y path traversal
   *
   * @param filename - Nombre original del archivo
   * @returns Nombre sanitizado
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
      .replace(/["\r\n]/g, "")
      .replace(/[/\\]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Verifica si el nombre del archivo necesita encoding UTF-8
   *
   * @param filename - Nombre del archivo
   * @returns true si contiene caracteres no-ASCII
   */
  private needsEncoding(filename: string): boolean {
    return /[^\x20-\x7E]/.test(filename);
  }

  /**
   * Crea un fallback ASCII para navegadores antiguos
   *
   * Convierte caracteres especiales a sus equivalentes ASCII
   *
   * @param filename - Nombre original
   * @returns Versión ASCII del nombre
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
   * Escapa comillas dobles en el filename
   *
   * @param filename - Nombre del archivo
   * @returns Nombre con comillas escapadas
   */
  private escapeQuotes(filename: string): string {
    return filename.replace(/"/g, '\\"');
  }

  /**
   * Codifica el filename según RFC 8187 (percent-encoding UTF-8)
   *
   * @param filename - Nombre del archivo
   * @returns Nombre codificado para filename*
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
   * Parse un header Content-Disposition existente
   *
   * @param header - Header Content-Disposition
   * @returns Objeto con type y filename parseados
   *
   * @example
   * ContentDisposition.parse('attachment; filename="report.pdf"');
   * // => { type: 'attachment', filename: 'report.pdf' }
   */
  public parse(header: string): {
    type: string;
    filename: string | null;
  } {
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
        if (value.startsWith('"') && value.endsWith('"'))
          value = value.slice(1, -1);

        filename = value.replace(/\\"/g, '"');
      }
    }

    return { type, filename };
  }
}
