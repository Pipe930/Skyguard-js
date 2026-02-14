import { stat, readFile } from "node:fs/promises";
import { resolve, basename, extname } from "node:path";
import { mimeTypesObject } from "./mimeTypes";
import { ContentDisposition } from "./contentDisposition";
import { Response } from "../http/response";
import {
  BadRequestError,
  HttpException,
  InternalServerError,
  NotFoundError,
} from "../exceptions/httpExceptions";

/**
 * Helper utility for serving file downloads.
 *
 * Builds a {@link Response} configured with safe headers
 * (`Content-Disposition`, `Content-Type`, `Content-Length`)
 * to send files to the client.
 */
export class FileDownloadHelper {
  private contentDisposition: ContentDisposition;

  constructor() {
    this.contentDisposition = new ContentDisposition();
  }

  /**
   * Creates a file download response.
   *
   * Resolves the file path, validates that it is a file,
   * reads its contents, and returns a {@link Response}
   * ready to be sent to the client.
   *
   * @param filePath - Path to the file on disk
   * @param filename - Optional custom filename for the download
   * @param headers - Optional additional response headers
   * @returns A {@link Response} configured for file download
   *
   * @throws {FileDownloadException}
   * Thrown if the file does not exist, is not a file,
   * or cannot be read.
   *
   * @example
   * const helper = new FileDownloadHelper();
   *
   * app.get("/download", async () => {
   *   return helper.download("./files/report.pdf");
   * });
   *
   * // Custom filename and headers
   * return helper.download(
   *   "./files/data.csv",
   *   "export.csv",
   *   { "Cache-Control": "no-store" }
   * );
   */
  public async download(
    filePath: string,
    filename?: string,
    headers?: Record<string, string>,
  ): Promise<Response> {
    try {
      const fullPath = resolve(filePath);
      const stats = await stat(fullPath);

      if (!stats.isFile()) throw new BadRequestError("Path is not a file");

      const content = await readFile(fullPath);
      const downloadName = filename || basename(fullPath);

      const downloadHeaders: Record<string, string> = {
        "Content-Disposition": this.contentDisposition.attachment(downloadName),
        "Content-Length": content.length.toString(),
        "Content-Type": this.getMimeType(fullPath),
      };

      if (headers) {
        for (const [key, value] of Object.entries(headers)) {
          // Prevent overriding Content-Disposition
          if (key.toLowerCase() !== "content-disposition")
            downloadHeaders[key] = value;
        }
      }

      return new Response()
        .setStatus(200)
        .setContent(content)
        .setHeaders(downloadHeaders);
    } catch (error) {
      if (error.syscall === "stat") throw new NotFoundError("File not found");
      if (error instanceof HttpException) throw error;
      throw new InternalServerError("Failed to download file");
    }
  }

  private getMimeType(filePath: string): string {
    const ext = extname(filePath).toLowerCase();
    return mimeTypesObject[ext] || "application/octet-stream";
  }
}
