import { randomBytes } from "node:crypto";
import { UnauthorizedError } from "../exceptions/httpExceptions";
import type { SessionData, SessionStorage } from "./sessionStorage";

const SESSION_ID_REGEX = /^[a-f0-9]{64}$/;

/**
 * In-memory session store.
 *
 * Good for development/testing only.
 */
export class MemorySessionStorage implements SessionStorage {
  private static storageSessions = new Map<string, SessionData>();

  private sessionId: string | null = null;
  private data: Record<string, unknown> = {};

  constructor(private readonly ttlSeconds: number = 86_400) {}

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

  public start(): void {
    if (this.sessionId) return;

    this.sessionId = this.generateId();
    this.data = {};
    this.save();
  }

  public id(): string | null {
    return this.sessionId;
  }

  public get<T = unknown>(key: string, defaultValue?: T): T | undefined {
    return (this.data[key] as T) ?? defaultValue;
  }

  public set(key: string, value: unknown): void {
    if (!this.sessionId) this.start();

    this.data[key] = value;
    this.save();
  }

  public has(key: string): boolean {
    return key in this.data;
  }

  public remove(key: string): void {
    if (!this.sessionId) return;

    delete this.data[key];
    this.save();
  }

  public all(): Record<string, unknown> {
    return { ...this.data };
  }

  public clear(): void {
    if (!this.sessionId) return;

    this.data = {};
    this.save();
  }

  public save(): void {
    if (!this.sessionId) return;

    MemorySessionStorage.storageSessions.set(this.sessionId, {
      data: { ...this.data },
      expiresAt: this.nextExpiry(),
    });
  }

  public touch(): void {
    if (!this.sessionId) return;

    const payload = MemorySessionStorage.storageSessions.get(this.sessionId);
    if (!payload) return;

    payload.expiresAt = this.nextExpiry();
  }

  public reload(): void {
    if (!this.sessionId) return;
    this.load(this.sessionId);
  }

  public destroy(): void {
    if (this.sessionId) {
      MemorySessionStorage.storageSessions.delete(this.sessionId);
    }

    this.sessionId = null;
    this.data = {};
  }

  public regenerate(): void {
    this.destroy();
    this.start();
  }

  public static cleanExpiredSessions(): void {
    const now = Date.now();

    for (const [id, session] of MemorySessionStorage.storageSessions) {
      if (session.expiresAt < now) MemorySessionStorage.storageSessions.delete(id);
    }
  }

  private nextExpiry(): number {
    return Date.now() + this.ttlSeconds * 1000;
  }

  private assertValidId(id: string): void {
    if (!SESSION_ID_REGEX.test(id)) {
      throw new UnauthorizedError("Invalid session");
    }
  }

  private generateId(): string {
    return randomBytes(32).toString("hex");
  }
}
