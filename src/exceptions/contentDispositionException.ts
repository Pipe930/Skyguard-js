import { BaseException } from "./baseException";

export class ContentDispositionException extends BaseException {
  constructor() {
    super("filename must be a non-empty string", "CONTENT_DISPOSITION_ERROR");
    this.name = "ContentDispositionException";
  }
}
