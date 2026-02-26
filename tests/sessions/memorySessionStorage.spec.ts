import { UnauthorizedError } from "../../src/exceptions/httpExceptions";
import { MemorySessionStorage } from "../../src/sessions/memorySessionStorage";

describe("Memory Session Storage Test", () => {
  const STORAGE_KEY = "storageSessions";

  const getStaticMap = (): Map<
    string,
    { data: Record<string, unknown>; expiresAt: number }
  > =>
    (MemorySessionStorage as unknown as Record<string, unknown>)[
      STORAGE_KEY
    ] as Map<string, { data: Record<string, unknown>; expiresAt: number }>;

  const clearStaticMap = () => {
    getStaticMap().clear();
  };

  const validId = (ch = "a") => ch.repeat(64);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    clearStaticMap();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts a new session and stores payload", () => {
    const storage = new MemorySessionStorage(10);

    storage.start();

    const id = storage.id();
    expect(id).toMatch(/^[a-f0-9]{64}$/);

    const entry = getStaticMap().get(id);
    expect(entry?.data).toEqual({});
    expect(entry?.expiresAt).toBe(Date.now() + 10_000);
  });

  it("set/get/remove/all/clear lifecycle", () => {
    const storage = new MemorySessionStorage(10);

    storage.set("user", "john");
    expect(storage.get("user")).toBe("john");
    expect(storage.all()).toEqual({ user: "john" });

    storage.remove("user");
    expect(storage.has("user")).toBe(false);

    storage.set("a", 1);
    storage.clear();
    expect(storage.all()).toEqual({});
  });

  it("throws for invalid id format or missing session", () => {
    const storage = new MemorySessionStorage(10);

    expect(() => storage.load("not-valid")).toThrow(UnauthorizedError);
    expect(() => storage.load(validId("b"))).toThrow(UnauthorizedError);
  });

  it("refreshes expiration with touch and reload", () => {
    const id = validId("c");
    getStaticMap().set(id, { data: { v: 1 }, expiresAt: Date.now() + 1_000 });

    const storage = new MemorySessionStorage(10);
    storage.load(id);

    expect(storage.get("v")).toBe(1);
    expect(getStaticMap().get(id)?.expiresAt).toBe(Date.now() + 10_000);

    jest.advanceTimersByTime(2_000);
    storage.touch();
    expect(getStaticMap().get(id)?.expiresAt).toBe(Date.now() + 10_000);

    storage.reload();
    expect(storage.id()).toBe(id);
  });

  it("throws when loading an expired session", () => {
    const id = validId("d");
    getStaticMap().set(id, { data: { a: 1 }, expiresAt: Date.now() });

    const storage = new MemorySessionStorage(10);

    expect(() => storage.load(id)).toThrow("Session expired");
  });

  it("regenerate replaces current session id", () => {
    const storage = new MemorySessionStorage(10);
    storage.start();
    const previous = storage.id();

    storage.regenerate();

    expect(storage.id()).not.toBe(previous);
    expect(storage.id()).toMatch(/^[a-f0-9]{64}$/);
  });

  it("removes only sessions with expiresAt < now", () => {
    const now = Date.now();
    getStaticMap().set(validId("e"), { data: {}, expiresAt: now - 1 });
    getStaticMap().set(validId("f"), { data: {}, expiresAt: now });

    MemorySessionStorage.cleanExpiredSessions();

    expect(getStaticMap().size).toBe(1);
    expect(getStaticMap().has(validId("f"))).toBe(true);
  });

  it("start() generates a valid 64-char hex id", () => {
    const storage = new MemorySessionStorage(10);
    storage.start();

    expect(storage.id()).toMatch(/^[a-f0-9]{64}$/);
  });
});
