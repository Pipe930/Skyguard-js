import { stat, readFile } from "node:fs/promises";
import { resolve, basename, extname } from "node:path";
import { mimeTypesObject } from "./mimeTypes";
import { ContentDisposition } from "./contentDisposition";
import { Response } from "../http/response";
import { FileDownloadException } from "../exceptions/fileDownloadException";

export class FileDownloadHelper {
  private contentDisposition: ContentDisposition;

  constructor() {
    this.contentDisposition = new ContentDisposition();
  }

  /**
   * Crea una respuesta para descargar un archivo
   *
   * @param filePath - Ruta del archivo a descargar
   * @param filename - Nombre personalizado para el archivo (opcional)
   * @param headers - Headers adicionales (opcional)
   * @returns Promise<Response> configurada para descarga
   */
  public async download(
    filePath: string,
    filename?: string,
    headers?: Record<string, string>,
  ): Promise<Response> {
    try {
      const fullPath = resolve(filePath);
      const stats = await stat(fullPath);

      if (!stats.isFile())
        throw new FileDownloadException(`Path is not a file: ${fullPath}`);

      const content = await readFile(fullPath);
      const downloadName = filename || basename(fullPath);
      const downloadHeaders: Record<string, string> = {
        "Content-Disposition": this.contentDisposition.attachment(downloadName),
        "Content-Length": content.length.toString(),
        "Content-Type": this.getMimeType(fullPath),
      };

      if (headers) {
        for (const [key, value] of Object.entries(headers)) {
          if (key.toLowerCase() !== "content-disposition")
            downloadHeaders[key] = value;
        }
      }

      return new Response()
        .setStatus(200)
        .setContent(content)
        .setHeaders(downloadHeaders);
    } catch {
      throw new FileDownloadException("Failed to download file");
    }
  }

  private getMimeType(filePath: string): string {
    const ext = extname(filePath).toLowerCase();
    return mimeTypesObject[ext] || "application/octet-stream";
  }
}
