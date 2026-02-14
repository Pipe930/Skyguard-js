export interface HttpExceptionOptions {
  message?: string;
  statusCode?: number;
  code?: string;
}

export class HttpException extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(options: HttpExceptionOptions) {
    super(options.message ?? "Internal Server Error");
    this.name = this.constructor.name;
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? "INTERNAL_SERVER_ERROR";

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
    };
  }
}

// Errores 4xx - Client
export class BadRequestError extends HttpException {
  constructor(message: string) {
    super({ message, statusCode: 400, code: "BAD_REQUEST" });
  }
}

export class UnauthorizedError extends HttpException {
  constructor(message: string) {
    super({ message, statusCode: 401, code: "UNAUTHORIZED" });
  }
}

export class ForbiddenError extends HttpException {
  constructor(message: string) {
    super({ message, statusCode: 403, code: "FORBIDDEN" });
  }
}

export class NotFoundError extends HttpException {
  constructor(message: string) {
    super({ message, statusCode: 404, code: "NOT_FOUND" });
  }
}

export class RequestTimeoutError extends HttpException {
  constructor(message: string) {
    super({ message, statusCode: 408, code: "REQUEST_TIMEOUT" });
  }
}

export class ConflictError extends HttpException {
  constructor(message: string) {
    super({ message, statusCode: 409, code: "CONFLICT" });
  }
}

export class UnsopportedMediaTypeError extends HttpException {
  constructor(message: string) {
    super({ message, statusCode: 415, code: "UNSOPPORTED_MEDIA_TYPE" });
  }
}

export class UnprocessableContentError extends HttpException {
  constructor(message: string) {
    super({ message, statusCode: 422, code: "UNPROCESSABLE_CONTENT" });
  }
}

export class TooManyRequestsError extends HttpException {
  constructor(message: string) {
    super({ message, statusCode: 429, code: "TOO_MANY_REQUESTS" });
  }
}

// Errores 5xx - Servidor
export class InternalServerError extends HttpException {
  constructor(message: string) {
    super({ message, statusCode: 500, code: "INTERNAL_SERVER_ERROR" });
  }
}

export class NotImplementedError extends HttpException {
  constructor(message: string) {
    super({ message, statusCode: 501, code: "NOT_IMPLEMENTED" });
  }
}

export class BadGatewayError extends HttpException {
  constructor(message: string) {
    super({ message, statusCode: 502, code: "BAD_GATEWAY" });
  }
}

export class ServiceUnavailableError extends HttpException {
  constructor(message: string) {
    super({ message, statusCode: 503, code: "SERVICE_UNAVAILABLE" });
  }
}

export class GatewayTimeoutError extends HttpException {
  constructor(message: string) {
    super({ message, statusCode: 504, code: "GATEWAY_TIMEOUT" });
  }
}
