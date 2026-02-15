/**
 * Contract for synchronous session storage implementations.
 *
 * Defines the basic operations required to manage a session
 * during the lifecycle of an HTTP request.
 *
 * Intended for synchronous drivers (e.g. in-memory storage).
 */
export interface SessionStorage {
  /**
   * Loads an existing session by its identifier.
   *
   * If the session does not exist or is invalid, implementations
   * may throw an exception or ignore the load according to
   * their internal policy.
   *
   * @param id - Unique session identifier
   */
  load(id: string): void | Promise<void>;

  /**
   * Starts a new session.
   *
   * If the session is already active, implementations
   * must avoid recreating it.
   */
  start(): void | Promise<void>;

  /**
   * Returns the identifier of the current session.
   *
   * @returns Active session ID
   */
  id(): string | null;

  /**
   * Retrieves a value from the session.
   *
   * @param key - Value key
   * @param defaultValue - Value returned if the key does not exist
   * @returns Stored value or the default value
   */
  get<T = unknown>(key: string, defaultValue?: T): T | undefined;

  /**
   * Stores a value in the session.
   *
   * If the session has not been started yet, implementations
   * must start it automatically.
   *
   * @param key - Value key
   * @param value - Value to store
   */
  set(key: string, value: unknown): void | Promise<void>;

  /**
   * Checks whether a key exists in the session.
   *
   * @param key - Key to check
   * @returns `true` if the key exists
   */
  has(key: string): boolean;

  /**
   * Removes a value from the session.
   *
   * @param key - Key to remove
   */
  remove(key: string): void | Promise<void>;

  /**
   * Completely destroys the session.
   *
   * Removes all associated data and invalidates the session
   * for subsequent requests.
   */
  destroy(): void;
}

/**
 * Internal representation of persisted session data.
 *
 * Used by {@link SessionStorage} implementations to store
 * session state on the server.
 *
 * @internal
 */
export interface SessionData {
  /** Data stored in the session. */
  data: Record<string, unknown>;

  /** Expiration timestamp in milliseconds. */
  expiresAt: number;
}
