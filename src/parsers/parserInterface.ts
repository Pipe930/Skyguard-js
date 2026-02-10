/**
 * Represents the final result of parsing a `multipart/form-data` request.
 *
 * This is the structure consumed by the rest of the framework
 * (controllers, validators, services, etc.).
 */
export interface MultipartData {
  fields: Record<string, string>;
  files: UploadedFile[];
}

/**
 * Represents a file uploaded via `multipart/form-data`.
 *
 * High-level abstraction ready to be consumed by controllers
 * and domain services.
 */
export interface UploadedFile {
  fieldName: string;
  filename: string;
  mimeType: string;
  data: Buffer;
  size: number;
}

/**
 * Represents a raw parsed multipart body part.
 *
 * Internal structure used by the multipart parser before
 * mapping data to the domain model ({@link MultipartData}).
 *
 * @internal
 */
export interface ParsedPart {
  name: string;
  filename?: string;
  contentType?: string;
  data: Buffer;
}
