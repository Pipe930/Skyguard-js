import {
  mkdir,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import {
  InternalServerError,
  UnauthorizedError,
} from "../exceptions/httpExceptions";
import {
  type SessionData,
  type SessionStorage,
  SESSION_ID_REGEX,
} from "./sessionStorage";

/**
 * File-backed session storage implementation.
 *
 * This session store persists each session as a JSON file on disk under
 * `storagePath`. The file name format is `sess_<id>.json`.
 *
 * Semantics:
 * - Sessions are identified by a cryptographically strong random ID (64 hex chars).
 * - Each write updates `expiresAt` based on `ttlSeconds` (sliding expiration).
 * - `load()` validates the ID, loads and validates the payload, and refreshes TTL.
 * - `destroy()` is best-effort regarding file deletion (unlink errors are ignored).
 *
 * ⚠️ Concurrency note:
 * This implementation performs atomic writes via a temporary file + rename, which
 * is generally safe for crash consistency. However, concurrent writers for the
 * same session ID may still last-write-wins.
 */
export class FileSessionStorage implements SessionStorage {
  /** Currently loaded/active session id, or null when no session is active. */
  private sessionId: string | null = null;

  /** In-memory session key/value data. */
  private data: Record<string, unknown> = {};

  /** Expiration timestamp in milliseconds since epoch. */
  private expiresAt = 0;

  /**
   * @param ttlSeconds - Session TTL in seconds. Used to compute `expiresAt`.
   * Defaults to 86,400 seconds (24 hours).
   * @param storagePath - Directory where session files are stored.
   * Defaults to "/tmp/sessions".
   */
  constructor(
    private readonly ttlSeconds: number = 86_400,
    private readonly storagePath: string = "/tmp/sessions",
  ) {}

  /**
   * Loads an existing session by id from disk.
   *
   * Flow:
   * 1) Validates session id format.
   * 2) Reads and parses the session payload from disk.
   * 3) If expired, attempts to delete the backing file and throws.
   * 4) Sets in-memory state and refreshes TTL (sliding expiration).
   *
   * @param id - Session identifier (must match `SESSION_ID_REGEX`).
   * @throws UnauthorizedError - If the id is invalid, payload is invalid,
   * missing, unreadable, or the session is expired.
   */
  public async load(id: string): Promise<void> {
    this.assertValidId(id);

    const payload = await this.readPayload(this.filePath(id));

    if (payload.expiresAt <= Date.now()) {
      await this.safeUnlink(this.filePath(id));
      throw new UnauthorizedError("Session expired");
    }

    this.sessionId = id;
    this.data = { ...payload.data };
    await this.touch();
  }

  /**
   * Starts a new session if none is active.
   *
   * Generates a new random session id, clears any in-memory data,
   * and persists the session to disk.
   *
   * If a session is already active, this is a no-op.
   */
  public async start(): Promise<void> {
    if (this.sessionId) return;

    this.sessionId = this.generateId();
    this.data = {};
    await this.save();
  }

  /**
   * Returns the current session id, or null if no session is active.
   */
  public id(): string | null {
    return this.sessionId;
  }

  /**
   * Gets a value from the session by key.
   *
   * @param key - Session key.
   * @param defaultValue - Value to return when the key is missing or nullish.
   * @returns The stored value casted to T, or `defaultValue` if missing.
   */
  public get<T = unknown>(key: string, defaultValue?: T): T | undefined {
    return (this.data[key] as T) ?? defaultValue;
  }

  /**
   * Sets a session key/value pair and persists the session.
   *
   * If no session is active, it will automatically start one.
   *
   * @param key - Session key.
   * @param value - Value to store (must be JSON-serializable to persist cleanly).
   * @throws InternalServerError - If persistence fails.
   */
  public async set(key: string, value: unknown): Promise<void> {
    if (!this.sessionId) await this.start();

    this.data[key] = value;
    await this.save();
  }

  /**
   * Checks whether the session contains a given key.
   *
   * @param key - Session key.
   */
  public has(key: string): boolean {
    return key in this.data;
  }

  /**
   * Removes a key from the session and persists the updated state.
   *
   * If no session is active, this is a no-op.
   *
   * @param key - Session key.
   * @throws InternalServerError - If persistence fails.
   */
  public async remove(key: string): Promise<void> {
    if (!this.sessionId) return;

    delete this.data[key];
    await this.save();
  }

  /**
   * Returns a shallow copy of all session data.
   */
  public all(): Record<string, unknown> {
    return { ...this.data };
  }

  /**
   * Clears all session data and persists.
   *
   * If no session is active, this is a no-op.
   *
   * @throws InternalServerError - If persistence fails.
   */
  public async clear(): Promise<void> {
    if (!this.sessionId) return;

    this.data = {};
    await this.save();
  }

  /**
   * Persists the current in-memory session to disk, updating its expiration.
   *
   * This updates `expiresAt` using the configured `ttlSeconds`
   * (sliding expiration).
   *
   * If no session is active, this is a no-op.
   *
   * @throws InternalServerError - If the write fails.
   */
  public async save(): Promise<void> {
    if (!this.sessionId) return;

    this.expiresAt = this.nextExpiry();
    await this.persist();
  }

  /**
   * Refreshes the session expiration and persists it.
   *
   * This is similar to `save()` but semantically communicates that only TTL
   * is being refreshed.
   *
   * If no session is active, this is a no-op.
   *
   * @throws InternalServerError - If the write fails.
   */
  public async touch(): Promise<void> {
    if (!this.sessionId) return;

    this.expiresAt = this.nextExpiry();
    await this.persist();
  }

  /**
   * Reloads the current session from disk (if active).
   *
   * If no session is active, this is a no-op.
   *
   * @throws UnauthorizedError - If the session cannot be loaded (invalid/missing/expired).
   */
  public async reload(): Promise<void> {
    if (!this.sessionId) return;
    await this.load(this.sessionId);
  }

  /**
   * Destroys the current session.
   *
   * Best-effort removes the backing file and clears in-memory state.
   * File deletion failures are intentionally ignored.
   */
  public async destroy(): Promise<void> {
    if (this.sessionId) await this.safeUnlink(this.filePath(this.sessionId));

    this.sessionId = null;
    this.data = {};
    this.expiresAt = 0;
  }

  /**
   * Regenerates the session id while preserving current data.
   *
   * This is typically used for security (e.g., mitigating session fixation).
   *
   * @throws InternalServerError - If persistence fails.
   */
  public async regenerate(): Promise<void> {
    const previous = this.all();
    await this.destroy();
    await this.start();

    this.data = previous;
    await this.save();
  }

  /**
   * Removes expired or invalid session files from a directory.
   *
   * This utility scans `storagePath` for files matching `sess_*.json`.
   * For each file, it attempts to parse `expiresAt` and deletes the file if:
   * - `expiresAt` is missing or not a number, OR
   * - `expiresAt` is in the past, OR
   * - the file is unreadable / invalid JSON.
   *
   * This is useful for periodic cleanup (cron/job) when using file-backed sessions.
   *
   * @param storagePath - Directory to scan. Defaults to "/tmp/sessions".
   */
  public static async cleanExpiredSessions(
    storagePath: string = "/tmp/sessions",
  ): Promise<void> {
    const now = Date.now();

    let entries: string[];
    try {
      entries = await readdir(storagePath);
    } catch {
      return;
    }

    await Promise.all(
      entries
        .filter(file => file.startsWith("sess_") && file.endsWith(".json"))
        .map(async file => {
          const fullPath = join(storagePath, file);

          try {
            const content = await readFile(fullPath, "utf-8");
            const payload = JSON.parse(content) as { expiresAt?: number };

            if (
              typeof payload.expiresAt !== "number" ||
              payload.expiresAt < now
            ) {
              await unlink(fullPath);
            }
          } catch {
            await unlink(fullPath);
          }
        }),
    );
  }

  /**
   * Ensures a session id matches the expected format.
   *
   * @param id - Session id to validate.
   * @throws UnauthorizedError - If the id does not match `SESSION_ID_REGEX`.
   */
  private assertValidId(id: string): void {
    if (!SESSION_ID_REGEX.test(id))
      throw new UnauthorizedError("Invalid session");
  }

  /**
   * Reads and validates a session payload from disk.
   *
   * @param path - Absolute path to the session file.
   * @returns Parsed session payload.
   * @throws UnauthorizedError - If the file cannot be read, JSON is invalid,
   * or required fields are missing/invalid.
   */
  private async readPayload(path: string): Promise<SessionData> {
    try {
      const content = await readFile(path, "utf-8");
      const payload = JSON.parse(content) as SessionData;

      if (typeof payload.expiresAt !== "number" || !payload.data) {
        throw new UnauthorizedError("Invalid session");
      }

      return payload;
    } catch {
      throw new UnauthorizedError("Invalid session");
    }
  }

  /**
   * Computes the next expiration timestamp based on `ttlSeconds`.
   */
  private nextExpiry(): number {
    return Date.now() + this.ttlSeconds * 1000;
  }

  /**
   * Builds the session file path for a given session id.
   *
   * @param id - Session id.
   */
  private filePath(id: string): string {
    return join(this.storagePath, `sess_${id}.json`);
  }

  /**
   * Persists the current session to disk using an atomic write pattern.
   *
   * @throws InternalServerError - If the session cannot be written.
   */
  private async persist(): Promise<void> {
    if (!this.sessionId) return;

    const filePath = this.filePath(this.sessionId);
    const payload: SessionData = {
      data: this.data,
      expiresAt: this.expiresAt,
    };

    const tempPath = `${filePath}.tmp`;

    try {
      await mkdir(this.storagePath, { recursive: true });
      await writeFile(tempPath, JSON.stringify(payload), "utf-8");
      await rename(tempPath, filePath);
    } catch {
      await this.safeUnlink(tempPath);
      throw new InternalServerError("Failed to save session data");
    }
  }

  /**
   * Best-effort file deletion helper.
   *
   * @param path - File path to remove.
   */
  private async safeUnlink(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch {
      // Ignore best-effort cleanup errors.
    }
  }

  /**
   * Generates a new cryptographically strong session id (32 random bytes -> 64 hex chars).
   */
  private generateId(): string {
    return randomBytes(32).toString("hex");
  }
}
