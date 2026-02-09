import { BaseException } from "./baseException";

export class SessionException extends BaseException {
  constructor(message: string) {
    super(message, "SESSION_ERROR");
    this.name = "SessionException";
  }
}
