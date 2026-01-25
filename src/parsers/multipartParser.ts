import { ContentParseError } from "../exceptions";
import { ContentParser } from "./contentParser";
import { MultipartData, ParsedPart } from "./parserInterface";

/**
 * Parser para contenido multipart/form-data.
 *
 * Implementa la interfaz {@link ContentParser} para integrarse
 * al sistema de parsing del framework.
 */
export class MultipartParser implements ContentParser {
  /**
   * Determina si este parser puede manejar el tipo de contenido indicado.
   *
   * @param contentType - Valor del header Content-Type.
   * @returns Devuelve un booleano validando si es multipart/form-data
   */
  public canParse(contentType: string): boolean {
    return contentType.includes("multipart/form-data");
  }

  /**
   * Parsea un cuerpo multipart/form-data y lo transforma
   * en una estructura tipada.
   *
   * @param body - Cuerpo crudo de la request.
   * @param contentType - Header Content-Type completo.
   * @returns Devuelve un objeto con los campos y archivos parseados.
   * @throws  Si no se encuentra el boundary.
   */
  public async parse(
    body: Buffer | string,
    contentType: string,
  ): Promise<MultipartData> {
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
    const boundary = this.extractBoundary(contentType);

    if (!boundary)
      throw new ContentParseError(
        "Missing boundary in multipart/form-data",
        "MISSING_BOUNDARY",
      );

    return this.parseMultipart(buffer, boundary);
  }

  /**
   * Extrae el boundary desde el header Content-Type.
   *
   * @param contentType - Header Content-Type.
   * @returns Devuelve un Boundary encontrado o null si no existe.
   */
  private extractBoundary(contentType: string): string | null {
    const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    return match ? match[1] || match[2] : null;
  }

  /**
   * Procesa el buffer multipart completo separando
   * cada parte del formulario.
   *
   * @param buffer - Cuerpo completo de la request.
   * @param boundary - Delimitador multipart.
   * @returns Devuelve el resultado en un objeto mostrando los campos y los archivos.
   */
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

  /**
   * Divide un buffer usando un delimitador.
   *
   * @param buffer - Buffer original.
   * @param delimiter - Separador (boundary).
   * @returns Devuelve una lista de partes resultantes.
   */
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

  /**
   * Parsea una parte individual del multipart.
   *
   * @param part - Segmento individual del multipart.
   * @returns Devuelve el contenido parseada o null si es inválida.
   */
  private parsePart(part: Buffer): ParsedPart | null {
    const headerEndIndex = part.indexOf("\r\n\r\n");
    if (headerEndIndex === -1) return null;

    const headerSection = part.slice(0, headerEndIndex).toString("utf-8");
    const bodySection = part.slice(headerEndIndex + 4);
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
   * Parsea un bloque de headers HTTP en formato texto.
   *
   * @param headerText - Texto de headers.
   * @returns Devuelve los headers normalizados.
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
}
