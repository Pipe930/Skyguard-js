import { UploadErrorCode, type Storage, type StorageOptions } from "./types";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { Request } from "../http/request";
import { UploadException } from "../exceptions/uploadException";
import type { UploadedFile } from "../parsers/parserInterface";

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
    this.destination = options.disk.destination ?? "./uploads";
    this.filenameGenerator =
      options.disk.filename ?? this.generateUniqueFilename;
  }

  /**
   * Persists an uploaded file to disk.
   *
   * The method resolves the destination directory, generates a filename,
   * writes the file buffer to disk, and returns the final file metadata.
   *
   * @param request Current HTTP request.
   * @param file Partial file metadata.
   * @param fileData File buffer received from the multipart parser.
   *
   * @returns A fully populated {@link UploadedFile} object describing the saved file.
   *
   * @throws UploadException if the file cannot be written to disk.
   */
  public async handleFile(
    request: Request,
    file: Partial<UploadedFile>,
    fileData: Buffer,
  ): Promise<UploadedFile> {
    try {
      const destination = await this.resolveDestination(request, file);
      const filename = await this.filenameGenerator(request, file);
      const filePath = join(destination, filename);

      await mkdir(destination, { recursive: true });
      await writeFile(filePath, fileData);

      return {
        fieldName: file.fieldName,
        originalname: file.originalname,
        encoding: file.encoding || "7bit",
        mimetype: file.mimetype,
        size: fileData.length,
        destination,
        filename,
        path: filePath,
        data: fileData,
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
      await unlink(file.path);
    }
  }

  /**
   * Resolves the destination directory.
   *
   * If a resolver function was provided, it will be executed.
   * Otherwise the static directory is returned.
   */
  private async resolveDestination(
    request: Request,
    file: Partial<UploadedFile>,
  ): Promise<string> {
    if (typeof this.destination === "function") {
      return await this.destination(request, file);
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
    request: Request,
    file: Partial<UploadedFile>,
  ): string {
    const timestamp = Date.now();
    const randomString = randomBytes(8).toString("hex");
    const ext = extname(file.originalname || "");
    return `${timestamp}-${randomString}${ext}`;
  }
}

/**
 * Improved in-memory storage engine for uploaded files.
 *
 * Enhancements over the simple implementation:
 * - Optional limits: per-file, total memory and file count
 * - Optional TTL for automatic cleanup
 * - Optional sha256 checksum computation attached as `checksum`
 * - Tracks stored items in an internal Map for potential future retrieval
 */
export class MemoryStorage implements Storage {
  private store = new Map<string, UploadedFile>();
  private totalSize = 0;
  private maxTotalSize: number;
  private maxFileSize?: number;
  private maxFiles: number;
  private ttlMs: number;
  private computeChecksum: boolean;

  constructor(options: StorageOptions = {}) {
    this.maxTotalSize = options.memory.maxTotalSize ?? 50 * 1024 * 1024; // 50MB
    this.maxFileSize = options.memory.maxFileSize;
    this.maxFiles = options.memory.maxFiles ?? Infinity;
    this.ttlMs = options.memory.ttlMs ?? 0;
    this.computeChecksum = options.memory.computeChecksum ?? false;
  }

  public handleFile(
    request: Request,
    file: Partial<UploadedFile>,
    fileData: Buffer,
  ): UploadedFile {
    // Enforce per-file size if configured
    if (this.maxFileSize !== undefined && fileData.length > this.maxFileSize) {
      throw new UploadException(
        `File too large. Max size: ${this.maxFileSize} bytes`,
        UploadErrorCode.LIMIT_FILE_SIZE,
        file.fieldName,
      );
    }

    // Enforce total memory limit and file count
    if (this.store.size + 1 > this.maxFiles) {
      throw new UploadException(
        `Too many files stored in memory. Max ${this.maxFiles}`,
        UploadErrorCode.LIMIT_FILE_COUNT,
        file.fieldName,
      );
    }

    if (this.totalSize + fileData.length > this.maxTotalSize) {
      throw new UploadException(
        `Memory limit exceeded. Max total size: ${this.maxTotalSize} bytes`,
        UploadErrorCode.LIMIT_FILE_SIZE,
        file.fieldName,
      );
    }

    const filename =
      file.filename || `${Date.now()}-${randomBytes(6).toString("hex")}`;

    const uploaded: UploadedFile = {
      fieldName: file.fieldName,
      filename,
      originalname: file.originalname,
      encoding: file.encoding || "7bit",
      mimetype: file.mimetype,
      size: fileData.length,
      data: fileData,
    };

    // Optionally compute checksum
    if (this.computeChecksum) {
      try {
        const hash = createHash("sha256");
        hash.update(fileData);
        uploaded.checksum = hash.digest("hex");
      } catch {
        // checksum failure shouldn't block storage; emit nothing here but keep storing
      }
    }

    // Store with optional expiry metadata
    if (this.ttlMs > 0) {
      // Use filename as key; if collisions occur, append random
      let key = filename;
      let attempt = 0;
      while (this.store.has(key)) {
        attempt += 1;
        key = `${filename}-${attempt}`;
      }

      this.store.set(key, uploaded);
    } else {
      let key = filename;
      let attempt = 0;
      while (this.store.has(key)) {
        attempt += 1;
        key = `${filename}-${attempt}`;
      }
      this.store.set(key, uploaded);
    }

    this.totalSize += fileData.length;

    return uploaded;
  }

  public removeFile(file: UploadedFile): void {
    // Find entry by identity (buffer equality) or by filename
    const entryKey = Array.from(this.store.entries()).find(
      ([, f]) => f === file,
    )?.[0];

    if (entryKey) {
      const f = this.store.get(entryKey);
      // Attempt to zero buffer reference to help GC
      try {
        f.data = Buffer.alloc(0);
      } catch {
        // ignore
      }
      this.totalSize = Math.max(0, this.totalSize - (f.size || 0));
      this.store.delete(entryKey);
    } else {
      // If not found by identity, try by filename
      const keyByName = Array.from(this.store.entries()).find(
        ([, f]) => f.filename === file.filename,
      )?.[0];
      if (keyByName) {
        const f = this.store.get(keyByName);
        try {
          f.data = Buffer.alloc(0);
        } catch {
          // Ignore catch
        }
        this.totalSize = Math.max(0, this.totalSize - (f.size || 0));
        this.store.delete(keyByName);
      }
    }
  }
}
