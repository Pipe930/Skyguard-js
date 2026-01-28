export abstract class BaseException extends Error {
  public readonly code: string;
  public readonly status?: number;
  public readonly meta?: Record<string, any>;

  protected constructor(
    message: string,
    code: string,
    status?: number,
    meta?: Record<string, any>,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.meta = meta;
  }
}
