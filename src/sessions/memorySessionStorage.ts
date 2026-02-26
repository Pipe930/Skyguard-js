import { randomBytes } from "node:crypto";
import { UnauthorizedError } from "../exceptions/httpExceptions";
import {
  type SessionData,
  type SessionStorage,
  SESSION_ID_REGEX,
} from "./sessionStorage";

/**
 * In-memory session store.
 *
 * This implementation keeps all sessions in a static `Map` shared across
 * all instances within the same Node.js process.
 *
 * Key properties:
 * - Fast and simple (no I/O).
 * - Sessions are NOT persisted across process restarts.
 * - Not suitable for multi-process or multi-server deployments.
 * - Intended for development/testing only.
 *
 * Semantics:
 * - Sessions use a cryptographically strong random ID (64 hex chars).
 * - Expiration is sliding: `save()` stores a new `expiresAt`, and `touch()`
 *   refreshes TTL for an existing session.
 */
export class MemorySessionStorage implements SessionStorage {
  /**
   * Process-wide session storage.
   *
   * Because this is `static`, all MemorySessionStorage instances share the
   * same backing Map.
   */
  private static storageSessions = new Map<string, SessionData>();

  /** Currently loaded/active session id, or null when no session is active. */
  private sessionId: string | null = null;

  /** In-memory session key/value data for the current session. */
  private data: Record<string, unknown> = {};

  /**
   * @param ttlSeconds - Session TTL in seconds. Defaults to 86,400 seconds (24 hours).
   */
  constructor(private readonly ttlSeconds: number = 86_400) {}

  /**
   * Loads an existing session by id from the in-memory Map.
   *
   * Flow:
   * 1) Validates session id format.
   * 2) Fetches payload from the static Map.
   * 3) If missing -> invalid session.
   * 4) If expired -> deletes it and throws.
   * 5) Sets in-memory state and refreshes TTL (sliding expiration).
   *
   * @param id - Session identifier (must match `SESSION_ID_REGEX`).
   * @throws UnauthorizedError - If the id is invalid, missing, or expired.
   */
  public load(id: string): void {
    this.assertValidId(id);

    const payload = MemorySessionStorage.storageSessions.get(id);
    if (!payload) throw new UnauthorizedError("Invalid session");

    if (payload.expiresAt <= Date.now()) {
      MemorySessionStorage.storageSessions.delete(id);
      throw new UnauthorizedError("Session expired");
    }

    this.sessionId = id;
    this.data = { ...payload.data };
    this.touch();
  }

  /**
   * Starts a new session if none is active.
   *
   * Generates a new random session id, clears in-memory data,
   * and writes an initial payload to the Map.
   *
   * If a session is already active, this is a no-op.
   */
  public start(): void {
    if (this.sessionId) return;

    this.sessionId = this.generateId();
    this.data = {};
    this.save();
  }

  /**
   * Returns the current session id, or null if no session is active.
   */
  public id(): string | null {
    return this.sessionId;
  }

  /**
   * Gets a value from the current session by key.
   *
   * @param key - Session key.
   * @param defaultValue - Value to return when the key is missing or nullish.
   * @returns The stored value casted to T, or `defaultValue` if missing.
   */
  public get<T = unknown>(key: string, defaultValue?: T): T | undefined {
    return (this.data[key] as T) ?? defaultValue;
  }

  /**
   * Sets a session key/value pair and persists the session payload.
   *
   * If no session is active, it will automatically start one.
   *
   * @param key - Session key.
   * @param value - Value to store.
   */
  public set(key: string, value: unknown): void {
    if (!this.sessionId) this.start();

    this.data[key] = value;
    this.save();
  }

  /**
   * Checks whether the current session contains a given key.
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
   */
  public remove(key: string): void {
    if (!this.sessionId) return;

    delete this.data[key];
    this.save();
  }

  /**
   * Returns a shallow copy of all current session data.
   */
  public all(): Record<string, unknown> {
    return { ...this.data };
  }

  /**
   * Clears all current session data and persists.
   *
   * If no session is active, this is a no-op.
   */
  public clear(): void {
    if (!this.sessionId) return;

    this.data = {};
    this.save();
  }

  /**
   * Persists the current session payload into the static Map, updating expiration.
   *
   * This method stores a cloned `data` object and a fresh `expiresAt`
   * computed from `ttlSeconds` (sliding expiration).
   *
   * If no session is active, this is a no-op.
   */
  public save(): void {
    if (!this.sessionId) return;

    MemorySessionStorage.storageSessions.set(this.sessionId, {
      data: { ...this.data },
      expiresAt: this.nextExpiry(),
    });
  }

  /**
   * Refreshes the expiration timestamp for the current session without rewriting data.
   *
   * If the session payload is missing (e.g., deleted externally), this is a no-op.
   *
   * If no session is active, this is a no-op.
   */
  public touch(): void {
    if (!this.sessionId) return;

    const payload = MemorySessionStorage.storageSessions.get(this.sessionId);
    if (!payload) return;

    payload.expiresAt = this.nextExpiry();
  }

  /**
   * Reloads the current session from the Map.
   *
   * If no session is active, this is a no-op.
   *
   * @throws UnauthorizedError - If the session becomes invalid/expired.
   */
  public reload(): void {
    if (!this.sessionId) return;
    this.load(this.sessionId);
  }

  /**
   * Destroys the current session.
   *
   * Removes the session payload from the static Map (if present) and clears
   * in-memory state.
   */
  public destroy(): void {
    if (this.sessionId) {
      MemorySessionStorage.storageSessions.delete(this.sessionId);
    }

    this.sessionId = null;
    this.data = {};
  }

  /**
   * Regenerates the session id.
   */
  public regenerate(): void {
    this.destroy();
    this.start();
  }

  /**
   * Removes expired sessions from the static Map.
   *
   * Useful for periodic cleanup in long-running processes/tests.
   */
  public static cleanExpiredSessions(): void {
    const now = Date.now();

    for (const [id, session] of MemorySessionStorage.storageSessions) {
      if (session.expiresAt < now)
        MemorySessionStorage.storageSessions.delete(id);
    }
  }

  /**
   * Computes the next expiration timestamp based on `ttlSeconds`.
   */
  private nextExpiry(): number {
    return Date.now() + this.ttlSeconds * 1000;
  }

  /**
   * Ensures a session id matches the expected format.
   *
   * @param id - Session id to validate.
   * @throws UnauthorizedError - If the id does not match `SESSION_ID_REGEX`.
   */
  private assertValidId(id: string): void {
    if (!SESSION_ID_REGEX.test(id)) {
      throw new UnauthorizedError("Invalid session");
    }
  }

  /**
   * Generates a new cryptographically strong session id (32 random bytes -> 64 hex chars).
   */
  private generateId(): string {
    return randomBytes(32).toString("hex");
  }
}
