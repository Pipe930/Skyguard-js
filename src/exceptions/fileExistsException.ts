import { BaseException } from "./baseException";

export class FileNotExistsException extends BaseException {
  constructor(resource: string) {
    super(`File not exists ${resource}`, "FILE_NOT_EXISTS_ERROR");
    this.name = "FileNotExistsException";
  }
}
