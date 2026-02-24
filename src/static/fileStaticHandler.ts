import { normalize, extname, basename, sep, resolve } from "node:path";
import { readFile, stat } from "node:fs/promises";
import { mimeTypesObject } from "./mimeTypes";
import { Response } from "../http/response";

/**
 * Static file handler for a public directory.
 *
 * Resolves and serves files from a configured `publicPath` using a URL prefix
 * derived from the directory name (e.g. `/public`).
 *
 * Includes basic path traversal protection and sets cache-related headers.
 *
 * @example
 * const staticFiles = new StaticFileHandler("./public");
 *
 * // In your request pipeline:
 * const response = await staticFiles.tryServeFile(request.getUrl);
 * if (response) return response;
 */
export class StaticFileHandler {
  private publicPath = "";
  private urlPrefix = "";
  private mimeTypes: Record<string, string>;

  constructor(publicPath: string) {
    this.publicPath = normalize(publicPath);
    this.urlPrefix = "/" + basename(this.publicPath);
    this.mimeTypes = mimeTypesObject;
  }

  /**
   * Returns the configured URL prefix.
   *
   * @returns URL prefix (e.g. `"/public"`)
   */
  public getUrlPrefix(): string {
    return this.urlPrefix;
  }

  /**
   * Checks whether the request path matches the static prefix.
   *
   * @param requestPath - Requested path
   * @returns `true` if the path starts with the prefix
   */
  public matchesPrefix(requestPath: string): boolean {
    return requestPath.startsWith(this.urlPrefix);
  }

  /**
   * Attempts to serve a static file.
   *
   * Returns `null` if:
   * - the request path does not match the prefix
   * - the resolved path escapes the public directory
   * - the file does not exist or is not a file
   * - an I/O error occurs
   *
   * @param requestPath - Requested path (e.g. `"/public/css/style.css"`)
   * @returns A {@link Response} containing the file, or `null` if not found
   *
   * @example
   * const response = await staticFiles.tryServeFile("/public/app.js");
   * if (response) return response;
   */
  public async tryServeFile(requestPath: string): Promise<Response | null> {
    try {
      if (!this.matchesPrefix(requestPath)) return null;

      const relativePath = requestPath.slice(this.urlPrefix.length);
      const filePath = resolve(
        this.publicPath,
        relativePath.replace(/^[/\\]+/, ""),
      );

      // Prevent path traversal (must stay within publicPath)
      if (!filePath.startsWith(this.publicPath + sep)) return null;

      const stats = await stat(filePath);
      if (!stats.isFile()) return null;

      const content = await readFile(filePath);
      const ext = extname(filePath).toLowerCase();
      const contentType = this.mimeTypes[ext] || this.mimeTypes["default"];

      return new Response()
        .setContent(content)
        .setHeaders({
          "content-type": contentType,
          "content-length": content.length.toString(),
          "cache-control": "public, max-age=31536000",
          "last-modified": stats.mtime.toUTCString(),
          ETag: `"${stats.size}-${stats.mtime.getTime()}"`,
        })
        .setStatusCode(200);
    } catch {
      return null;
    }
  }

  /**
   * Checks whether a request path looks like a static file request.
   *
   * This is a fast heuristic: it requires a file extension and a known mime type.
   *
   * @param requestPath - Requested path
   * @returns `true` if it looks like a static file request
   */
  public isStaticFileRequest(requestPath: string): boolean {
    if (!this.matchesPrefix(requestPath)) return false;

    const ext = extname(requestPath);
    return ext !== "" && ext in this.mimeTypes;
  }
}
