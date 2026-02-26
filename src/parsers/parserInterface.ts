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
  /** Name of the multipart field that produced the file */
  fieldName: string;

  /** Generated filename used on disk */
  filename: string;

  /** MIME type detected from the multipart payload */
  mimetype: string;

  /** File size in bytes */
  size: number;

  /** Original filename from the client */
  originalname?: string;

  /** File transfer encoding (usually "7bit") */
  encoding?: string;

  /** Directory where the file was saved */
  destination?: string;

  /** Absolute or relative path to the stored file */
  path?: string;

  /** Raw file buffer when using MemoryStorage */
  data: Buffer;
  /** Optional checksum (e.g. sha256) computed by storage engines */
  checksum?: string;
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
