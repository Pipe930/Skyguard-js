/**
 * Contract for session storage implementations.
 *
 * Inspired by express-session store capabilities, adapted to Skyguard.
 */
export interface SessionStorage {
  /** Load an existing session by id. */
  load(id: string): void | Promise<void>;

  /** Start a new session if none is active. */
  start(): void | Promise<void>;

  /** Return the active session id, or `null`. */
  id(): string | null;

  /** Get a value from session data. */
  get<T = unknown>(key: string, defaultValue?: T): T | undefined;

  /** Set a value in session data. */
  set(key: string, value: unknown): void | Promise<void>;

  /** Check if a key exists in session data. */
  has(key: string): boolean;

  /** Remove a key from session data. */
  remove(key: string): void | Promise<void>;

  /** Return a shallow copy of session data. */
  all(): Record<string, unknown>;

  /** Remove every key in current session data. */
  clear(): void | Promise<void>;

  /** Persist current in-memory session state. */
  save(): void | Promise<void>;

  /** Refresh session expiration without changing data. */
  touch(): void | Promise<void>;

  /** Reload current session from backing storage. */
  reload(): void | Promise<void>;

  /** Destroy current session and invalidate id. */
  destroy(): void | Promise<void>;

  /** Regenerate a brand-new session id preserving API expectations. */
  regenerate(): void | Promise<void>;
}

/**
 * Internal representation of persisted session data.
 */
export interface SessionData {
  data: Record<string, unknown>;
  expiresAt: number;
}
