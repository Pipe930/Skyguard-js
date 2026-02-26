import {
  type FileFilter,
  StorageType,
  type UploaderConfig,
  type UploadLimits,
  type Storage,
  UploadErrorCode,
  type FieldConfig,
} from "./types";
import { Request } from "../http/request";
import { UploadException } from "../exceptions/uploadException";
import { DiskStorage, MemoryStorage } from "./storage";
import type { Middleware, RouteHandler } from "../types";
import {
  type MultipartData,
  type UploadedFile,
} from "../parsers/parserInterface";

/**
 * Core uploader component.
 *
 * The {@link Uploader} class provides a set of middleware builders that process
 * `multipart/form-data` payloads already parsed by your multipart parser and
 * attached to the {@link Request} as {@link MultipartData}.
 *
 * Notes:
 * - If the request body is not multipart (i.e., no {@link MultipartData} found),
 *   the middleware is a no-op and simply calls `next(request)`.
 * - Errors are thrown as {@link UploadException} with an {@link UploadErrorCode}.
 */
class Uploader {
  /** Storage engine used to persist or hold uploaded files. */
  private storage: Storage;

  /**
   * Normalized upload limits. Values are always present due to defaults.
   * (`fields` may be Infinity when not limited.)
   */
  private limits: Required<UploadLimits>;

  /** Optional file filter used to accept/reject files before storage. */
  private fileFilter?: FileFilter;

  /**
   * Creates a new uploader instance.
   *
   * Storage resolution order:
   * 1) If `config.storage` is provided, it is used directly.
   * 2) Otherwise, `config.storageType` is used (defaults to DISK) and a storage
   *    instance is created using `config.storageOptions`.
   *
   * Limits are normalized to defaults when not provided.
   *
   * @param config Uploader configuration (storage, limits, file filter).
   */
  constructor(config: UploaderConfig = {}) {
    if (config.storage) {
      this.storage = config.storage;
    } else {
      const storageType = config.storageType ?? StorageType.DISK;
      this.storage = this.createStorage(storageType, config.storageOptions);
    }

    this.limits = {
      fileSize: config.limits?.fileSize ?? 10 * 1024 * 1024,
      files: config.limits?.files ?? 10,
      fields: config.limits?.fields ?? Infinity,
      fieldNameSize: config.limits?.fieldNameSize ?? 100,
      fieldSize: config.limits?.fieldSize ?? 1024 * 1024,
    };

    this.fileFilter = config.fileFilter;
  }

  /**
   * Builds a middleware that accepts a single file from the given field.
   *
   * Behavior:
   * - If no multipart payload is present, it passes through.
   * - If the file field does not exist, it does not error; it only attaches text
   *   fields and continues.
   * - If present, the file is validated, filtered (optional), stored via the
   *   configured {@link Storage}, and attached as `request.file`.
   *
   * @param fieldName Multipart field name expected to contain a file.
   * @returns A framework {@link Middleware} to be used in the route pipeline.
   *
   * @throws UploadException
   * - LIMIT_FIELD_COUNT if too many fields are present
   * - LIMIT_FILE_SIZE if the file exceeds the configured limit
   * - INVALID_FILE_TYPE if rejected by the filter
   */
  public single(fieldName: string): Middleware {
    return async (request: Request, next: RouteHandler) => {
      const multipartData = this.getMultipartData(request);

      if (!multipartData) return await next(request);

      this.validateFieldLimits(multipartData);

      const fileData = multipartData.files.find(f => f.fieldName === fieldName);

      if (!fileData) {
        this.attachFieldsToRequest(request, multipartData);
        return await next(request);
      }

      this.validateFileSize(fileData);
      await this.applyFileFilter(request, fileData);

      const file = await this.processFile(request, fileData);

      request.file = file;
      this.attachFieldsToRequest(request, multipartData);

      return await next(request);
    };
  }

  /**
   * Builds a middleware that accepts multiple files from the same field.
   *
   * Behavior:
   * - If no multipart payload is present, it passes through.
   * - If no files exist for the given field, it sets `request.files = []`,
   *   attaches text fields, and continues.
   * - If the number of files exceeds `maxCount`, it throws.
   * - Each file is validated, filtered (optional), stored, and collected into
   *   `request.files` as an array of {@link UploadedFile}.
   *
   * @param fieldName Multipart field name expected to contain files.
   * @param maxCount Maximum number of files allowed for this field.
   * @returns A framework {@link Middleware}.
   *
   * @throws UploadException
   * - LIMIT_FILE_COUNT if more than `maxCount` files are provided
   * - LIMIT_FIELD_COUNT if too many fields are present
   * - LIMIT_FILE_SIZE if any file exceeds the configured limit
   * - INVALID_FILE_TYPE if any file is rejected by the filter
   */
  public array(fieldName: string, maxCount: number = 10): Middleware {
    return async (request: Request, next: RouteHandler) => {
      const multipartData = this.getMultipartData(request);

      if (!multipartData) return await next(request);

      this.validateFieldLimits(multipartData);

      const filesData = multipartData.files.filter(
        file => file.fieldName === fieldName,
      );

      if (filesData.length === 0) {
        request.files = [];
        this.attachFieldsToRequest(request, multipartData);
        return await next(request);
      }

      if (filesData.length > maxCount) {
        throw new UploadException(
          `Too many files. Expected max ${maxCount} but got ${filesData.length}`,
          UploadErrorCode.LIMIT_FILE_COUNT,
          fieldName,
        );
      }

      const files: UploadedFile[] = [];
      for (const fileData of filesData) {
        this.validateFileSize(fileData);
        await this.applyFileFilter(request, fileData);
        files.push(await this.processFile(request, fileData));
      }

      request.files = files;
      this.attachFieldsToRequest(request, multipartData);

      return await next(request);
    };
  }

  /**
   * Builds a middleware that accepts multiple named fields with files.
   *
   * Behavior:
   * - Rejects any file whose field name is not declared in `fields`.
   * - Enforces `maxCount` per declared field (defaults to 1).
   * - Aggregates results as `request.files` in a map:
   *   `{ [fieldName]: UploadedFile[] }`.
   *
   * @param fields List of allowed fields and their per-field maximum counts.
   * @returns A framework {@link Middleware}.
   *
   * @throws UploadException
   * - LIMIT_UNEXPECTED_FILE if an undeclared field is received
   * - LIMIT_FILE_COUNT if a field exceeds its `maxCount`
   * - LIMIT_FIELD_COUNT if too many non-file fields are present
   * - LIMIT_FILE_SIZE if any file exceeds size limit
   * - INVALID_FILE_TYPE if rejected by the filter
   */
  public fields(fields: FieldConfig[]): Middleware {
    return async (request: Request, next: RouteHandler) => {
      const multipartData = this.getMultipartData(request);

      if (!multipartData) return await next(request);

      this.validateFieldLimits(multipartData);

      const filesMap: Record<string, UploadedFile[]> = {};
      const fieldMap = new Map(
        fields.map(field => [field.name, field.maxCount || 1]),
      );

      for (const fileData of multipartData.files) {
        const maxCount = fieldMap.get(fileData.fieldName);

        if (maxCount === undefined) {
          throw new UploadException(
            `Unexpected field "${fileData.fieldName}"`,
            UploadErrorCode.LIMIT_UNEXPECTED_FILE,
            fileData.fieldName,
          );
        }

        filesMap[fileData.fieldName] ||= [];

        if (filesMap[fileData.fieldName].length >= maxCount) {
          throw new UploadException(
            `Too many files for field "${fileData.fieldName}". Max ${maxCount}`,
            UploadErrorCode.LIMIT_FILE_COUNT,
            fileData.fieldName,
          );
        }

        this.validateFileSize(fileData);
        await this.applyFileFilter(request, fileData);
        filesMap[fileData.fieldName].push(
          await this.processFile(request, fileData),
        );
      }

      request.files = filesMap;
      this.attachFieldsToRequest(request, multipartData);

      return await next(request);
    };
  }

  /**
   * Builds a middleware that accepts any file field.
   *
   * Behavior:
   * - Enforces the global total file limit: `limits.files`.
   * - Stores all files and attaches them as `request.files` (array).
   *
   * @returns A framework {@link Middleware}.
   *
   * @throws UploadException
   * - LIMIT_FILE_COUNT if total files exceeds the global limit
   * - LIMIT_FIELD_COUNT if too many fields are present
   * - LIMIT_FILE_SIZE if any file exceeds size limit
   * - INVALID_FILE_TYPE if rejected by the filter
   */
  public any(): Middleware {
    return async (request: Request, next: RouteHandler) => {
      const multipartData = this.getMultipartData(request);

      if (!multipartData) return await next(request);

      this.validateFieldLimits(multipartData);

      if (multipartData.files.length > this.limits.files)
        throw new UploadException(
          `Too many files. Max ${this.limits.files}`,
          UploadErrorCode.LIMIT_FILE_COUNT,
        );

      const files: UploadedFile[] = [];
      for (const fileData of multipartData.files) {
        this.validateFileSize(fileData);
        await this.applyFileFilter(request, fileData);
        files.push(await this.processFile(request, fileData));
      }

      request.files = files;
      this.attachFieldsToRequest(request, multipartData);

      return await next(request);
    };
  }

  /**
   * Builds a middleware that rejects any uploaded file, allowing only text fields.
   *
   * Behavior:
   * - If any file is present in the multipart payload, it throws.
   * - Otherwise, it only merges text fields into the request and continues.
   *
   * @returns A framework {@link Middleware}.
   *
   * @throws UploadException
   * - LIMIT_UNEXPECTED_FILE if at least one file is received
   */
  public none(): Middleware {
    return async (request: Request, next: RouteHandler) => {
      const multipartData = this.getMultipartData(request);

      if (!multipartData) return await next(request);

      if (multipartData.files.length > 0) {
        throw new UploadException(
          "No files expected",
          UploadErrorCode.LIMIT_UNEXPECTED_FILE,
          multipartData.files[0].fieldName,
        );
      }

      this.attachFieldsToRequest(request, multipartData);

      return await next(request);
    };
  }

  /**
   * Persists a single file using the configured {@link Storage} engine.
   *
   * @param req Current HTTP request.
   * @param fileData File descriptor from {@link MultipartData}.
   * @returns The stored file metadata returned by the storage engine.
   */
  private async processFile(
    request: Request,
    fileData: MultipartData["files"][0],
  ): Promise<UploadedFile> {
    const partialFile: Partial<UploadedFile> = {
      fieldName: fileData.fieldName,
      originalname: fileData.filename,
      mimetype: fileData.mimetype,
      size: fileData.size,
    };

    return await this.storage.handleFile(request, partialFile, fileData.data);
  }

  /**
   * Extracts multipart data from the request if available.
   *
   * @param request Current HTTP request.
   * @returns Parsed multipart data or null if not present.
   */
  private getMultipartData(request: Request): MultipartData | null {
    if (
      request.headers["content-type"] &&
      request.headers["content-type"].startsWith("multipart/form-data")
    )
      return request.data as unknown as MultipartData;

    return null;
  }

  /**
   * Executes the configured {@link FileFilter}, if any.
   *
   * The filter can accept or reject a file. Rejections are normalized into an
   * {@link UploadException} with {@link UploadErrorCode.INVALID_FILE_TYPE}.
   *
   * @param req Current HTTP request.
   * @param fileData File descriptor from {@link MultipartData}.
   *
   * @throws UploadException when the filter rejects the file
   * @throws Error when the filter throws or returns an error
   */
  private async applyFileFilter(
    request: Request,
    fileData: MultipartData["files"][0],
  ): Promise<void> {
    if (!this.fileFilter) return;

    const partialFile: Partial<UploadedFile> = {
      fieldName: fileData.fieldName,
      originalname: fileData.filename,
      mimetype: fileData.mimetype,
    };

    return new Promise<void>((resolve, reject) => {
      this.fileFilter(request, partialFile, (error, acceptFile) => {
        if (error) return reject(error);

        if (!acceptFile) {
          return reject(
            new UploadException(
              `File type not allowed: ${fileData.mimetype}`,
              UploadErrorCode.INVALID_FILE_TYPE,
              fileData.fieldName,
            ),
          );
        }
        resolve();
      });
    });
  }

  /**
   * Validates that the file size does not exceed `limits.fileSize`.
   *
   * @param fileData File descriptor from {@link MultipartData}.
   * @throws UploadException if the file size exceeds the configured limit.
   */
  private validateFileSize(fileData: MultipartData["files"][0]): void {
    if (fileData.size > this.limits.fileSize) {
      throw new UploadException(
        `File too large. Max size: ${this.limits.fileSize} bytes`,
        UploadErrorCode.LIMIT_FILE_SIZE,
        fileData.fieldName,
      );
    }
  }

  /**
   * Validates the number of non-file fields in the multipart payload.
   *
   * @param multipartData Parsed multipart payload.
   * @throws UploadException if field count exceeds `limits.fields`.
   */
  private validateFieldLimits(multipartData: MultipartData): void {
    const fieldCount = Object.keys(multipartData.fields).length;

    if (fieldCount > this.limits.fields)
      throw new UploadException(
        `Too many fields. Max ${this.limits.fields}`,
        UploadErrorCode.LIMIT_FIELD_COUNT,
      );
  }

  /**
   * Merges multipart text fields into the request body data.
   *
   * This keeps the original request data structure but adds/overrides values
   * with the parsed multipart text fields.
   *
   * @param req Current HTTP request.
   * @param multipartData Parsed multipart payload containing text fields.
   */
  private attachFieldsToRequest(
    request: Request,
    multipartData: MultipartData,
  ): void {
    const currentData = request.data || {};
    const newData = {
      ...currentData,
      ...multipartData.fields,
    };
    request.setData(newData);
  }

  /**
   * Creates a storage engine instance from the selected {@link StorageType}.
   *
   * @param type Storage type identifier.
   * @param options Storage options forwarded to the implementation.
   * @returns A concrete {@link Storage} engine.
   */
  private createStorage(type: StorageType, options: any = {}): Storage {
    switch (type) {
      case StorageType.DISK:
        return new DiskStorage(options);
      case StorageType.MEMORY:
        return new MemoryStorage();
      default:
        return new DiskStorage(options);
    }
  }
}

/**
 * Factory helper to create an {@link Uploader} instance.
 *
 * @param config Optional uploader configuration.
 * @returns A configured {@link Uploader}.
 */
export function createUploader(config?: UploaderConfig): Uploader {
  return new Uploader(config);
}
