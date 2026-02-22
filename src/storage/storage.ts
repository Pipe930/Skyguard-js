import {
  type StorageOptions,
  type UploadedFile,
  UploadErrorCode,
  type Storage,
} from "./types";
import { writeFile, unlink } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomBytes } from "node:crypto";
import { Request } from "../http/request";
import { UploadException } from "../exceptions/uploadException";

/**
 * Disk-based storage engine responsible for persisting uploaded files
 * to the local filesystem.
 *
 * This storage implementation writes incoming file buffers to disk and
 * returns metadata describing the stored file.
 *
 * The destination directory and filename strategy are fully configurable
 * and can be static values or dynamic resolver functions.
 */
export class DiskStorage implements Storage {
  /**
   * Destination directory or resolver function that determines where
   * files should be stored.
   *
   * If a function is provided, it will receive the current request and
   * partial file metadata and must return a directory path.
   */
  private destination:
    | string
    | ((
        request: Request,
        file: Partial<UploadedFile>,
      ) => string | Promise<string>);

  /**
   * Function responsible for generating the final filename of the stored file.
   * If not provided, a unique filename will be generated automatically.
   */
  private filenameGenerator: (
    request: Request,
    file: Partial<UploadedFile>,
  ) => string | Promise<string>;

  /**
   * Creates a new DiskStorage instance.
   *
   * @param options Storage configuration options.
   *  - `destination`: Directory path or resolver function.
   *  - `filename`: Custom filename generator function.
   *
   * Defaults:
   *  - destination: "./uploads"
   *  - filename: auto-generated unique filename
   */
  constructor(options: StorageOptions = {}) {
    this.destination = options.destination || "./uploads";
    this.filenameGenerator = options.filename || this.generateUniqueFilename;
  }

  /**
   * Persists an uploaded file to disk.
   *
   * The method resolves the destination directory, generates a filename,
   * writes the file buffer to disk, and returns the final file metadata.
   *
   * @param req Current HTTP request.
   * @param file Partial file metadata.
   * @param fileData File buffer received from the multipart parser.
   *
   * @returns A fully populated {@link UploadedFile} object describing the saved file.
   *
   * @throws UploadException if the file cannot be written to disk.
   */
  public async handleFile(
    req: Request,
    file: Partial<UploadedFile>,
    fileData: Buffer,
  ): Promise<UploadedFile> {
    try {
      const destination = await this.resolveDestination(req, file);
      const filename = await this.filenameGenerator(req, file);
      const filePath = join(destination, filename);

      await writeFile(filePath, fileData);

      return {
        fieldName: file.fieldName!,
        originalname: file.originalname!,
        encoding: file.encoding || "7bit",
        mimetype: file.mimetype!,
        size: fileData.length,
        destination,
        filename,
        path: filePath,
      };
    } catch (error) {
      throw new UploadException(
        `Failed to save file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        UploadErrorCode.LIMIT_FILE_SIZE,
        file.fieldName,
      );
    }
  }

  /**
   * Removes a previously stored file from disk.
   *
   * This method silently ignores filesystem errors to avoid breaking
   * request pipelines during cleanup operations.
   *
   * @param file File metadata returned by {@link handleFile}.
   */
  public async removeFile(file: UploadedFile): Promise<void> {
    if (file.path) {
      try {
        await unlink(file.path);
      } catch {}
    }
  }

  /**
   * Resolves the destination directory.
   *
   * If a resolver function was provided, it will be executed.
   * Otherwise the static directory is returned.
   */
  private async resolveDestination(
    req: Request,
    file: Partial<UploadedFile>,
  ): Promise<string> {
    if (typeof this.destination === "function") {
      return await this.destination(req, file);
    }
    return this.destination;
  }

  /**
   * Default filename generator.
   *
   * Produces a collision-resistant filename using:
   *  - Current timestamp
   *  - Random 16-byte hex string
   *  - Original file extension
   *
   * Example:
   *  1700000000000-a3f9b1c2d4e5f678.png
   */
  private generateUniqueFilename(
    req: Request,
    file: Partial<UploadedFile>,
  ): string {
    const timestamp = Date.now();
    const randomString = randomBytes(8).toString("hex");
    const ext = extname(file.originalname || "");
    return `${timestamp}-${randomString}${ext}`;
  }
}

/**
 * In-memory storage engine for uploaded files.
 *
 * Instead of persisting files to disk, this storage keeps the file buffer
 * directly in memory and attaches it to the {@link UploadedFile} object.
 *
 * This is useful for:
 *  - Temporary file processing
 *  - Cloud uploads (S3, GCS, etc.)
 *  - Image/video processing pipelines
 *
 * ⚠️ Not recommended for large files or high-concurrency environments,
 * as memory usage grows with each upload.
 */
export class MemoryStorage implements Storage {
  /**
   * Handles the uploaded file by storing it in memory.
   *
   * The file buffer is attached to the returned {@link UploadedFile}.
   *
   * @param req Current HTTP request.
   * @param file Partial file metadata.
   * @param fileData Raw file buffer.
   *
   * @returns Uploaded file metadata including the in-memory buffer.
   */
  public async handleFile(
    req: Request,
    file: Partial<UploadedFile>,
    fileData: Buffer,
  ): Promise<UploadedFile> {
    return {
      fieldName: file.fieldName!,
      originalname: file.originalname!,
      encoding: file.encoding || "7bit",
      mimetype: file.mimetype!,
      size: fileData.length,
      buffer: fileData,
    };
  }

  /**
   * No-op cleanup method.
   *
   * Since files are stored in memory, there is nothing to remove.
   * Node.js garbage collector will reclaim the memory automatically.
   */
  public async removeFile(file: UploadedFile): Promise<void> {
    // Nothing to clean up for memory storage
  }
}
