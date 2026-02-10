import type { SessionStorage } from "./sessionStorage";

/**
 * Represents an active session associated with an HTTP request.
 *
 * Acts as a facade over a {@link SessionStorage} implementation,
 * exposing a simple and fluent API to interact with session data.
 *
 * Storage concerns (persistence, expiration, loading) are handled
 * by the `SessionStorage` and the session middleware.
 */
export class Session {
  /**
   * Creates a new `Session` instance.
   *
   * This class is instantiated internally by the session middleware
   * and should not be created manually by framework users.
   *
   * @param sessionStorage - Concrete {@link SessionStorage} implementation
   * responsible for managing the session lifecycle
   */
  constructor(private sessionStorage: SessionStorage) {
    this.sessionStorage = sessionStorage;
  }

  /**
   * Returns the unique identifier of the current session.
   *
   * @returns Session ID
   */
  public id(): string {
    return this.sessionStorage.id();
  }

  /**
   * Retrieves a value stored in the session.
   *
   * @param key - Value key
   * @param defaultValue - Value returned if the key does not exist
   * @returns Stored value or the default value
   *
   * @example
   * const userId = session.get<number>("user_id");
   */
  public get<T = unknown>(key: string, defaultValue?: T): T {
    return this.sessionStorage.get(key, defaultValue);
  }

  /**
   * Stores a value in the session.
   *
   * Supports method chaining.
   *
   * @param key - Value key
   * @param value - Value to store
   * @returns The current {@link Session} instance
   *
   * @example
   * session
   *   .set("user_id", 1)
   *   .set("role", "admin");
   */
  public set(key: string, value: unknown): this {
    this.sessionStorage.set(key, value);
    return this;
  }

  /**
   * Checks whether a key exists in the session.
   *
   * @param key - Key to check
   * @returns `true` if the key exists
   */
  public has(key: string): boolean {
    return this.sessionStorage.has(key);
  }

  /**
   * Removes a value from the session.
   *
   * Supports method chaining.
   *
   * @param key - Key to remove
   * @returns The current {@link Session} instance
   */
  public remove(key: string): this {
    this.sessionStorage.remove(key);
    return this;
  }

  /**
   * Completely destroys the current session.
   *
   * Removes all associated data and invalidates the session
   * for subsequent requests.
   *
   * @returns The current {@link Session} instance
   */
  public destroy(): this {
    this.sessionStorage.destroy();
    return this;
  }
}
