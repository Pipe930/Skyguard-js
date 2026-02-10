import { SessionException } from "../exceptions/sessionException";
import type { SessionData, SessionStorage } from "./sessionStorage";
import { randomBytes } from "node:crypto";

/**
 * In-memory {@link SessionStorage} implementation.
 *
 * Stores all sessions in a static `Map` shared at the Node.js process level.
 *
 * ⚠️ Important:
 * - Sessions are lost when the process restarts
 * - Not safe for multi-instance or clustered environments
 * - Recommended only for development, testing, or prototyping
 *
 * Session lifecycle:
 * 1) `start()` → creates a new session
 * 2) `load(id)` → loads an existing session
 * 3) Read/write session data
 * 4) `destroy()` → removes the session
 */
export class MemorySessionStorage implements SessionStorage {
  /**
   * Global in-memory session storage.
   *
   * Key: session ID
   * Value: session data and expiration timestamp
   */
  private static storageSessions = new Map<string, SessionData>();

  /** Currently loaded session ID */
  private sessionId: string | null = null;

  /** Session data */
  private data: Record<string, unknown> = {};

  /** Strict validation for session ID format */
  private regexSessionId = /^[a-f0-9]{64}$/;

  /**
   * Creates a new `MemorySessionStorage` instance.
   *
   * @param expiredSession - Session lifetime in milliseconds
   */
  constructor(private readonly expiredSession: number) {}

  /**
   * Loads an existing session by its ID.
   *
   * @param id - Session identifier
   * @throws {SessionException}
   * Thrown if the ID is invalid, does not exist, or the session is expired
   */
  public load(id: string): void {
    if (!this.regexSessionId.test(id))
      throw new SessionException("Invalid session");

    const sessionData = MemorySessionStorage.storageSessions.get(id);
    if (!sessionData) throw new SessionException("Invalid session");

    if (sessionData.expiresAt > Date.now()) {
      this.sessionId = id;
      this.data = sessionData.data;
      sessionData.expiresAt = this.createExpiredSession();
    }
  }

  /**
   * Computes the next session expiration timestamp.
   *
   * @returns Expiration timestamp
   */
  private createExpiredSession(): number {
    return Date.now() + this.expiredSession;
  }

  /**
   * Starts a new session if none is active.
   */
  public start(): void {
    if (this.sessionId) return;

    this.sessionId = this.generateId();
    this.data = {};

    MemorySessionStorage.storageSessions.set(this.sessionId, {
      data: this.data,
      expiresAt: this.createExpiredSession(),
    });
  }

  /**
   * Returns the current session ID.
   *
   * @returns Session ID or `null` if no session is active
   */
  public id(): string | null {
    return this.sessionId;
  }

  /**
   * Retrieves a value from the session.
   *
   * @param key - Value key
   * @param defaultValue - Optional default value
   * @returns Stored value or the default value
   */
  public get<T>(key: string, defaultValue?: T): T | undefined {
    return (this.data[key] as T) ?? defaultValue;
  }

  /**
   * Stores a value in the session.
   *
   * Automatically starts a session if none exists.
   *
   * @param key - Value key
   * @param value - Value to store
   */
  public set<T>(key: string, value: T): void {
    if (!this.sessionId) this.start();
    this.data[key] = value;
  }

  /**
   * Checks whether a key exists in the session.
   *
   * @param key - Key to check
   * @returns `true` if the key exists
   */
  public has(key: string): boolean {
    return key in this.data;
  }

  /**
   * Removes a key from the session.
   *
   * Does nothing if no session is active.
   *
   * @param key - Key to remove
   */
  public remove(key: string): void {
    if (!this.sessionId) return;
    delete this.data[key];
  }

  /**
   * Completely destroys the current session.
   */
  public destroy(): void {
    if (this.sessionId) {
      MemorySessionStorage.storageSessions.delete(this.sessionId);
    }

    this.sessionId = null;
    this.data = {};
  }

  /**
   * Removes all expired sessions from memory.
   *
   * This method should be executed periodically
   * (e.g. via a cron job or interval).
   */
  public static cleanExpiredSessions(): void {
    const now = Date.now();

    for (const [id, session] of MemorySessionStorage.storageSessions) {
      if (session.expiresAt < now) {
        MemorySessionStorage.storageSessions.delete(id);
      }
    }
  }

  /**
   * Generates a cryptographically secure session identifier.
   *
   * @returns Hex-encoded session ID (64 characters)
   */
  private generateId(): string {
    return randomBytes(32).toString("hex");
  }
}
