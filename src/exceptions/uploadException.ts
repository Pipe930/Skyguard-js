import { BaseException } from "./baseException";

export class UploadException extends BaseException {
  constructor(
    message: string,
    public code: string,
    public field?: string,
  ) {
    super(message, "UPLOAD_ERROR");
    this.name = "UploadError";
  }
}
