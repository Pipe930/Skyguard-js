import { join, normalize, extname, basename } from "node:path";
import { readFile, stat } from "node:fs/promises";
import { mimeTypesObject } from "./mimeTypes";
import { Response } from "../http";

export class StaticFileHandler {
  private publicPath: string;
  private urlPrefix: string;
  private mimeTypes: Record<string, string>;

  constructor(publicPath: string) {
    this.publicPath = normalize(publicPath);
    this.urlPrefix = "/" + basename(this.publicPath);
    this.mimeTypes = mimeTypesObject;
  }

  /**
   * Obtiene el prefijo URL configurado
   *
   * @returns El prefijo de URL (ej: "/public")
   */
  public getUrlPrefix(): string {
    return this.urlPrefix;
  }

  /**
   * Verifica si la petición coincide con el prefijo de archivos estáticos
   *
   * @param requestPath - Ruta solicitada
   * @returns true si la ruta comienza con el prefijo
   */
  public matchesPrefix(requestPath: string): boolean {
    return requestPath.startsWith(this.urlPrefix);
  }

  /**
   * Intenta servir un archivo estático de forma asíncrona
   *
   * @param requestPath - Ruta solicitada (ej: "/public/css/style.css")
   * @returns Promise<Response> con el archivo o null si no existe
   */
  public async tryServeFile(requestPath: string): Promise<Response | null> {
    try {
      if (!this.matchesPrefix(requestPath)) return null;

      const relativePath = requestPath.substring(this.urlPrefix.length);
      const normalizedPath = this.normalizedPath(relativePath);
      const filePath = join(this.publicPath, normalizedPath);

      if (!filePath.startsWith(this.publicPath)) return null;

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
          "cache-control": "public, max-age=31536000", // Cache por 1 año
          "last-modified": stats.mtime.toUTCString(),
          ETag: `"${stats.size}-${stats.mtime.getTime()}"`,
        })
        .setStatus(200);
    } catch {
      return null;
    }
  }

  /**
   * Verifica si una ruta podría ser un archivo estático
   *
   * @param requestPath - Ruta solicitada
   * @returns true si tiene extensión de archivo y coincide con el prefijo
   */
  public isStaticFileRequest(requestPath: string): boolean {
    if (!this.matchesPrefix(requestPath)) return false;

    const ext = extname(requestPath);
    return ext !== "" && ext in this.mimeTypes;
  }

  private normalizedPath(path: string): string {
    return normalize(path).replace(/^(\.\.[\/\\])+/, "");
  }
}
