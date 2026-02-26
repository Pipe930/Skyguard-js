import type { SessionStorage } from "./sessionStorage";

/**
 * Request session facade.
 */
export class Session {
  constructor(private readonly sessionStorage: SessionStorage) {}

  public id(): string | null {
    return this.sessionStorage.id();
  }

  public get<T = unknown>(key: string, defaultValue?: T): T | undefined {
    return this.sessionStorage.get(key, defaultValue);
  }

  public all(): Record<string, unknown> {
    return this.sessionStorage.all();
  }

  public has(key: string): boolean {
    return this.sessionStorage.has(key);
  }

  public async set(key: string, value: unknown): Promise<void> {
    await this.sessionStorage.set(key, value);
  }

  public async remove(key: string): Promise<void> {
    await this.sessionStorage.remove(key);
  }

  public async clear(): Promise<void> {
    await this.sessionStorage.clear();
  }

  public async save(): Promise<void> {
    await this.sessionStorage.save();
  }

  public async touch(): Promise<void> {
    await this.sessionStorage.touch();
  }

  public async reload(): Promise<void> {
    await this.sessionStorage.reload();
  }

  public async destroy(): Promise<void> {
    await this.sessionStorage.destroy();
  }

  public async regenerate(): Promise<void> {
    await this.sessionStorage.regenerate();
  }
}
