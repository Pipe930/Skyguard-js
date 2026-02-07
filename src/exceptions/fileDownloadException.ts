import { BaseException } from "./baseException";

export class FileDownloadException extends BaseException {
  constructor(message: string) {
    super(message, "FILE_DOWNLOAD_EXCEPTION");
    this.name = "FileDownloadException";
  }
}
