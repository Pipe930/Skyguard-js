import { BaseException } from "./baseException";

/**
 * HTTP exception not found hereda de Error
 */
export class HttpNotFoundException extends BaseException {
  constructor() {
    super("Route not found", "HTTP_NOT_FOUND_EXCEPTION");
    this.name = "HttpNotFoundException";
  }
}
