import { BaseException } from "./baseException";

export class HelperNotFoundException extends BaseException {
  constructor(helperName: string) {
    super(`Helper "${helperName}" is not registered`, "HELPER_NOT_FOUND_ERROR");
    this.name = "HelperNotFoundException";
  }
}

export class HelperExecutionException extends BaseException {
  constructor(helperName: string) {
    super(`Error executing helper "${helperName}"`, "HELPER_EXECUTION_ERROR");
    this.name = "HelperExecutionError";
  }
}

export class HelperArgumentException extends BaseException {
  constructor(helperName: string) {
    super(
      `Invalid argument for helper "${helperName}"`,
      "HELPER_ARGUMENT_ERROR",
    );
    this.name = "HelperArgumentError";
  }
}
