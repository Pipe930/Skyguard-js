/**
 * Error personalizado para errores de parseo de contenido.
 */
export class ContentParseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = "ContentParseError";
  }
}
