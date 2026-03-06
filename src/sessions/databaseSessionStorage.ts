import { randomBytes } from "node:crypto";
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
 * Persistence contract for DB-backed sessions.
 *
 * Implement this adapter with your DB client/ORM (mysql, mariaDB, sqlite,
 * postgresql, mssql, oracle, etc.).
 */
export interface SessionDatabaseAdapter {
  findById(id: string): Promise<SessionData | null>;
  upsert(id: string, payload: SessionData): Promise<void>;
  deleteById(id: string): Promise<void>;
  deleteExpired(now: number): Promise<void>;
}

/**
 * Database-backed session storage.
 *
 * The storage is DB-engine agnostic. Consumers provide a
 * {@link SessionDatabaseAdapter} implementation that translates these methods
 * to the concrete SQL/driver API used by the project.
 */
export class DatabaseSessionStorage implements SessionStorage {
  private static adapter: SessionDatabaseAdapter | null = null;

  private sessionId: string | null = null;
  private data: Record<string, unknown> = {};
  private expiresAt = 0;

  constructor(private readonly ttlSeconds: number = 86_400) {}

  public static configure(adapter: SessionDatabaseAdapter): void {
    DatabaseSessionStorage.adapter = adapter;
  }

  public static clearAdapter(): void {
    DatabaseSessionStorage.adapter = null;
  }

  public static async cleanExpiredSessions(now = Date.now()): Promise<void> {
    await this.getAdapter().deleteExpired(now);
  }

  public async load(id: string): Promise<void> {
    this.assertValidId(id);

    const payload = await this.readOrFail(id);

    if (payload.expiresAt <= Date.now()) {
      await this.safeDelete(id);
      throw new UnauthorizedError("Session expired");
    }

    this.sessionId = id;
    this.data = { ...payload.data };
    this.expiresAt = payload.expiresAt;

    await this.touch();
  }

  public async start(): Promise<void> {
    if (this.sessionId) return;

    this.sessionId = this.generateId();
    this.data = {};
    this.expiresAt = this.nextExpiry();
    await this.persist();
  }

  public id(): string | null {
    return this.sessionId;
  }

  public get<T = unknown>(key: string, defaultValue?: T): T | undefined {
    return (this.data[key] as T) ?? defaultValue;
  }

  public async set(key: string, value: unknown): Promise<void> {
    if (!this.sessionId) await this.start();

    this.data[key] = value;
    await this.save();
  }

  public has(key: string): boolean {
    return key in this.data;
  }

  public async remove(key: string): Promise<void> {
    if (!this.sessionId) return;

    delete this.data[key];
    await this.save();
  }

  public all(): Record<string, unknown> {
    return { ...this.data };
  }

  public async clear(): Promise<void> {
    if (!this.sessionId) return;

    this.data = {};
    await this.save();
  }

  public async save(): Promise<void> {
    if (!this.sessionId) return;

    this.expiresAt = this.nextExpiry();
    await this.persist();
  }

  public async touch(): Promise<void> {
    if (!this.sessionId) return;

    this.expiresAt = this.nextExpiry();
    await this.persist();
  }

  public async reload(): Promise<void> {
    if (!this.sessionId) return;
    await this.load(this.sessionId);
  }

  public async destroy(): Promise<void> {
    if (this.sessionId) await this.safeDelete(this.sessionId);

    this.sessionId = null;
    this.data = {};
    this.expiresAt = 0;
  }

  public async regenerate(): Promise<void> {
    const previous = this.all();
    await this.destroy();
    await this.start();

    this.data = previous;
    await this.save();
  }

  private static getAdapter(): SessionDatabaseAdapter {
    if (!DatabaseSessionStorage.adapter) {
      throw new InternalServerError(
        "DatabaseSessionStorage adapter not configured",
      );
    }

    return DatabaseSessionStorage.adapter;
  }

  private async persist(): Promise<void> {
    if (!this.sessionId) return;

    const payload: SessionData = {
      data: { ...this.data },
      expiresAt: this.expiresAt,
    };

    try {
      await DatabaseSessionStorage.getAdapter().upsert(this.sessionId, payload);
    } catch {
      throw new InternalServerError("Failed to save session data");
    }
  }

  private async readOrFail(id: string): Promise<SessionData> {
    try {
      const payload = await DatabaseSessionStorage.getAdapter().findById(id);
      if (!payload || typeof payload.expiresAt !== "number" || !payload.data) {
        throw new UnauthorizedError("Invalid session");
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      throw new InternalServerError("Failed to load session data");
    }
  }

  private async safeDelete(id: string): Promise<void> {
    try {
      await DatabaseSessionStorage.getAdapter().deleteById(id);
    } catch {
      // best-effort cleanup
    }
  }

  private nextExpiry(): number {
    return Date.now() + this.ttlSeconds * 1000;
  }

  private assertValidId(id: string): void {
    if (!SESSION_ID_REGEX.test(id))
      throw new UnauthorizedError("Invalid session");
  }

  private generateId(): string {
    return randomBytes(32).toString("hex");
  }
}
