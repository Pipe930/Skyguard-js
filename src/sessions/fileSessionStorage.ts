import {
  readFile,
  writeFile,
  unlink,
  readdir,
  mkdir,
  rename,
} from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { SessionData, SessionStorage } from "./sessionStorage";
import {
  InternalServerError,
  UnauthorizedError,
} from "../exceptions/httpExceptions";

/**
 * File-backed session storage implementation.
 *
 * Stores each session as a JSON file on the local filesystem using the pattern:
 * `sess_<sessionId>.json`
 *
 * ## Data format (on disk)
 * Each session file contains a {@link SessionData} payload:
 * ```json
 * {
 *   "data": { "...": "..." },
 *   "expiresAt": 1700000000000
 * }
 * ```
 *
 * ## Security model
 * - Session IDs must be 64 lowercase hex characters (32 random bytes → hex).
 * - Loading an invalid, missing, corrupted or expired session throws {@link UnauthorizedError}.
 *
 * ## Expiration model
 * - Uses **sliding expiration**: every successful {@link load} refreshes `expiresAt`
 *   and persists the updated timestamp to disk.
 * - `expiredSession` is expected to be the cookie max-age value (commonly in seconds),
 *   which is converted to milliseconds internally.
 *
 * ## I/O and atomicity
 * - Writes are done atomically by writing to a temporary file and then `rename()`-ing it.
 * - Session directory is created lazily via `mkdir({ recursive: true })`.
 */
export class FileSessionStorage implements SessionStorage {
  /** Current session id, or null if the session has not started. */
  private sessionId: string | null = null;

  /** In-memory session key-value store. */
  private data: Record<string, unknown> = {};

  /** Absolute expiration timestamp (epoch ms). */
  private expiresAt = 0;

  /** Absolute path to the current session file. */
  private sessionPath = "";

  /** Strict validation for session identifiers. */
  private readonly regexSessionId = /^[a-f0-9]{64}$/;

  /**
   * Creates a file-based session storage.
   *
   * @param expiredSession - Session lifetime (commonly cookie `Max-Age`).
   *   **Note:** this implementation treats the value as seconds and converts it to ms.
   * @param storagePath - Directory where session files are stored.
   */
  constructor(
    private readonly expiredSession: number,
    private readonly storagePath: string = "/tmp/sessions",
  ) {}

  /**
   * Loads an existing session by id.
   *
   * Validates the session id, reads the corresponding file from disk, verifies
   * structure, and checks expiration.
   *
   * @param id - Session identifier (64 lowercase hex characters).
   * @throws UnauthorizedError - If the id is invalid, file is missing/corrupt,
   *   payload is invalid, or the session is expired.
   */
  public async load(id: string): Promise<void> {
    if (!this.regexSessionId.test(id))
      throw new UnauthorizedError("Invalid session");

    const path = this.buildSessionPath(id);

    let payload: SessionData | null = null;
    try {
      const content = await readFile(path, "utf-8");
      payload = JSON.parse(content) as SessionData;
    } catch {
      throw new UnauthorizedError("Invalid session");
    }

    if (!payload || typeof payload.expiresAt !== "number" || !payload.data)
      throw new UnauthorizedError("Invalid session");

    const now = Date.now();
    if (payload.expiresAt < now) {
      await this.safeUnlink(path);
      throw new UnauthorizedError("Session expired");
    }

    // Load data and renew TTL (sliding expiration).
    this.sessionId = id;
    this.sessionPath = path;
    this.data = payload.data ?? {};
    this.expiresAt = this.createExpiredSession();

    await this.save();
  }

  /**
   * Starts a new session if none exists yet.
   *
   * This method is designed so the session id is assigned **before any awaited I/O**
   * to avoid race conditions in middleware that checks {@link id} after the handler runs.
   */
  public async start(): Promise<void> {
    if (this.sessionId) return;

    // Assign id/path immediately (important for middleware flow).
    this.sessionId = this.generateId();
    this.sessionPath = join(this.storagePath, `sess_${this.sessionId}.json`);
    this.data = {};
    this.expiresAt = this.createExpiredSession();

    await this.ensureStorageDir();
    await this.save();
  }

  /**
   * Returns the current session id, or null if the session has not started.
   */
  public id(): string | null {
    return this.sessionId;
  }

  /**
   * Reads a value from the session.
   *
   * @param key - Session key.
   * @param defaultValue - Fallback value when the key is missing.
   * @returns The stored value casted to `T`, or `defaultValue` if missing.
   */
  public get<T = unknown>(key: string, defaultValue?: T): T | undefined {
    return (this.data[key] as T) ?? defaultValue;
  }

  /**
   * Sets a session value and persists it.
   *
   * If the session has not started yet, it will be started automatically.
   *
   * @param key - Session key.
   * @param value - Value to store (must be JSON-serializable to be persisted).
   */
  public async set(key: string, value: unknown): Promise<void> {
    if (!this.sessionId) await this.start();
    this.data[key] = value;
    await this.save();
  }

  /**
   * Checks whether a key exists in the session.
   */
  public has(key: string): boolean {
    return key in this.data;
  }

  /**
   * Removes a key from the session and persists.
   *
   * No-op if the session has not started.
   */
  public async remove(key: string): Promise<void> {
    if (!this.sessionId) return;

    delete this.data[key];
    await this.save();
  }

  /**
   * Destroys the current session.
   *
   * In strict mode this removes the backing file (best-effort) and clears
   * in-memory state.
   */
  public async destroy(): Promise<void> {
    if (this.sessionPath) {
      await this.safeUnlink(this.sessionPath);
    }

    this.sessionId = null;
    this.sessionPath = "";
    this.data = {};
    this.expiresAt = 0;
  }

  /**
   * Returns a shallow copy of all session entries.
   * @returns Session data as a plain object.
   */
  public all(): Record<string, unknown> {
    return { ...this.data };
  }

  /**
   * Deletes expired or corrupt session files under a directory.
   *
   * Intended to be called from a scheduled job (cron) or periodically by the server.
   *
   * - Expired sessions (`expiresAt < now`) are deleted.
   * - Corrupt/unreadable files are deleted as best-effort.
   *
   * @param storagePath - Directory where session files are stored.
   */
  public static async cleanExpiredSessions(
    storagePath: string = "/tmp/sessions",
  ): Promise<void> {
    const now = Date.now();

    let entries: string[] = [];
    try {
      entries = await readdir(storagePath);
    } catch {
      return;
    }

    await Promise.all(
      entries
        .filter(f => f.startsWith("sess_") && f.endsWith(".json"))
        .map(async file => {
          const full = join(storagePath, file);
          try {
            const content = await readFile(full, "utf-8");
            const payload = JSON.parse(content) as { expiresAt?: number };

            if (
              typeof payload?.expiresAt === "number" &&
              payload.expiresAt < now
            ) {
              await unlink(full);
            }
          } catch {
            // Corrupt/unreadable → best-effort cleanup
            await unlink(full);
          }
        }),
    );
  }

  /**
   * Builds the absolute file path for a given session id.
   */
  private buildSessionPath(id: string): string {
    return join(this.storagePath, `sess_${id}.json`);
  }

  /**
   * Computes the expiration timestamp for a new/renewed session.
   *
   * This implementation converts the configured TTL from seconds to milliseconds.
   * If your framework already passes TTL in milliseconds, remove the `* 1000`.
   */
  private createExpiredSession(): number {
    const ttlMs = this.expiredSession * 1000;
    return Date.now() + ttlMs;
  }

  /**
   * Ensures the storage directory exists.
   *
   * @throws InternalServerError - If the directory cannot be created.
   */
  private async ensureStorageDir(): Promise<void> {
    try {
      await mkdir(this.storagePath, { recursive: true });
    } catch {
      throw new InternalServerError("Failed to initialize session storage");
    }
  }

  /**
   * Persists the current session to disk using an atomic write strategy:
   * write to `<file>.tmp` and then rename to the final path.
   *
   * @throws InternalServerError - If the session cannot be persisted.
   */
  private async save(): Promise<void> {
    if (!this.sessionPath) return;

    const payload: SessionData = {
      data: this.data,
      expiresAt: this.expiresAt,
    };

    const tmpPath = `${this.sessionPath}.tmp`;

    try {
      await this.ensureStorageDir();
      await writeFile(tmpPath, JSON.stringify(payload), "utf-8");
      await rename(tmpPath, this.sessionPath);
    } catch {
      await this.safeUnlink(tmpPath);
      throw new InternalServerError("Failed to save session data");
    }
  }

  /**
   * Best-effort file deletion (ignores errors).
   */
  private async safeUnlink(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch {
      /** eslint-disable-next-line no-empty */
    }
  }

  /**
   * Generates a cryptographically strong session id (64 hex chars).
   */
  private generateId(): string {
    return randomBytes(32).toString("hex");
  }
}
