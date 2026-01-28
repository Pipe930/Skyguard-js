import { BaseException } from "./baseException";

/**
 * Error personalizado para errores de parseo de contenido.
 */
export class ContentParserException extends BaseException {
  constructor(message: string) {
    super(message, "CONTENT_PARSER_ERROR");
    this.name = "ContentParserException";
  }
}

export class ReadBodyException extends BaseException {
  constructor() {
    super("Failed to read request body", "READ_BODY_REQUEST_ERROR");
    this.name = "ReadBodyException";
  }
}
