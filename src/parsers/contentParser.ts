/**
 * Interfaz para parsers de contenido HTTP.
 * Cada parser es responsable de transformar el body crudo
 * a un formato utilizable por el framework.
 */
export interface ContentParser {
  /**
   * Determina si este parser puede manejar el Content-Type dado.
   */
  canParse(contentType: string): boolean;

  /**
   * Parsea el contenido del body.
   *
   * @param body - Buffer o string del body crudo
   * @param contentType - Content-Type completo (puede incluir charset, boundary, etc)
   * @returns Objeto parseado o el contenido original si no se puede parsear
   */
  parse(body: Buffer | string, contentType: string): Promise<unknown>;
}
