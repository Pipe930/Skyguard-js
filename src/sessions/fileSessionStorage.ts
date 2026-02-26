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
import type { SessionData, SessionStorage } from "./sessionStorage";

const SESSION_ID_REGEX = /^[a-f0-9]{64}$/;

/**
 * File-backed session storage implementation.
 */
export class FileSessionStorage implements SessionStorage {
  private sessionId: string | null = null;
  private data: Record<string, unknown> = {};
  private expiresAt = 0;

  constructor(
    private readonly ttlSeconds: number = 86_400,
    private readonly storagePath: string = "/tmp/sessions",
  ) {}

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

  public async start(): Promise<void> {
    if (this.sessionId) return;

    this.sessionId = this.generateId();
    this.data = {};
    await this.save();
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
    if (this.sessionId) await this.safeUnlink(this.filePath(this.sessionId));

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

            if (typeof payload.expiresAt !== "number" || payload.expiresAt < now) {
              await unlink(fullPath);
            }
          } catch {
            await unlink(fullPath);
          }
        }),
    );
  }

  private assertValidId(id: string): void {
    if (!SESSION_ID_REGEX.test(id)) throw new UnauthorizedError("Invalid session");
  }

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

  private nextExpiry(): number {
    return Date.now() + this.ttlSeconds * 1000;
  }

  private filePath(id: string): string {
    return join(this.storagePath, `sess_${id}.json`);
  }

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

  private async safeUnlink(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch {
      // Ignore best-effort cleanup errors.
    }
  }

  private generateId(): string {
    return randomBytes(32).toString("hex");
  }
}
