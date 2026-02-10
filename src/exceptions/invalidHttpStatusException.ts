import { BaseException } from "./baseException";

export class InvalidHttpStatusException extends BaseException {
  constructor(status: number) {
    super(`Invalid HTTP status code: ${status}`, "INVALID_HTTP_STATUS_ERROR");
    this.name = "InvalidHttpStatusException";
  }
}
