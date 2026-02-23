import type { UploadedFile } from "../parsers/parserInterface";
import { Request } from "../http/request";

/**
 * Available storage engine types.
 *
 * Determines where uploaded files will be stored.
 *
 * - DISK: Files are persisted to the local filesystem.
 * - MEMORY: Files are kept in memory as Buffer objects.
 */
export enum StorageType {
  DISK = "disk",
  MEMORY = "memory",
}

/**
 * Upload limits configuration.
 *
 * These limits protect the application against excessive payloads
 * and resource exhaustion attacks.
 */
export interface UploadLimits {
  /** Maximum allowed size per file (in bytes) */
  fileSize?: number;

  /** Maximum number of uploaded files */
  files?: number;

  /** Maximum number of non-file fields */
  fields?: number;

  /** Maximum length of a field name */
  fieldNameSize?: number;

  /** Maximum size of a field value (in bytes) */
  fieldSize?: number;
}

/**
 * Storage engine configuration options.
 */
export interface StorageOptions {
  /**
   * Destination directory or resolver function.
   * If a function is provided, it receives the request and file metadata.
   */
  destination?:
    | string
    | ((req: Request, file: Partial<UploadedFile>) => string | Promise<string>);

  /**
   * Custom filename generator.
   * Receives the request and partial file metadata.
   */
  filename?: (
    req: Request,
    file: Partial<UploadedFile>,
  ) => string | Promise<string>;
}

/**
 * Storage engine contract.
 *
 * Custom storage engines must implement this interface
 * to integrate with the uploader.
 */
export interface Storage {
  /**
   * Processes and stores an uploaded file.
   *
   * @param request Current HTTP request.
   * @param file Partial file metadata.
   * @param fileData Raw file buffer.
   * @returns Final uploaded file metadata.
   */
  handleFile(
    request: Request,
    file: Partial<UploadedFile>,
    fileData: Buffer,
  ): Promise<UploadedFile>;

  /**
   * Removes a stored file.
   *
   * Used for cleanup or rollback scenarios.
   */
  removeFile(file: UploadedFile): Promise<void>;
}

/**
 * Callback used by the file filter to signal acceptance or rejection.
 *
 * @param error Error describing why the file was rejected.
 * @param acceptFile Indicates whether the file should be accepted.
 */
export type FileFilterCallback = (
  error: Error | null,
  acceptFile: boolean,
) => void;

/**
 * Function used to filter uploaded files before storage.
 *
 * Allows developers to validate MIME types, extensions,
 * file names, or any custom business rule.
 *
 * The callback must be invoked to accept or reject the file.
 */
export type FileFilter = (
  request: Request,
  file: Partial<UploadedFile>,
  callback: FileFilterCallback,
) => void | Promise<void>;

/**
 * Global uploader configuration.
 */
export interface UploaderConfig {
  /** Custom storage engine instance */
  storage?: Storage;

  /** Storage type used when no custom storage is provided */
  storageType?: StorageType;

  /** Options passed to the selected storage engine */
  storageOptions?: StorageOptions;

  /** Upload limits configuration */
  limits?: UploadLimits;

  /** File filtering function */
  fileFilter?: FileFilter;

  /** Whether to preserve full client file paths */
  preservePath?: boolean;
}

/**
 * Configuration for field-based uploads.
 *
 * Used by the `fields()` middleware to define allowed fields.
 */
export interface FieldConfig {
  /** Field name expected in multipart form */
  name: string;

  /** Maximum number of files allowed for this field */
  maxCount?: number;
}

/**
 * Common uploader error codes.
 *
 * These codes allow applications to handle upload errors
 * in a structured and predictable way.
 */
export enum UploadErrorCode {
  LIMIT_FILE_SIZE = "LIMIT_FILE_SIZE",
  LIMIT_FILE_COUNT = "LIMIT_FILE_COUNT",
  LIMIT_FIELD_COUNT = "LIMIT_FIELD_COUNT",
  LIMIT_UNEXPECTED_FILE = "LIMIT_UNEXPECTED_FILE",
  INVALID_FILE_TYPE = "INVALID_FILE_TYPE",
  MISSING_FIELD = "MISSING_FIELD",
}
