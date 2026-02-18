import { MemorySessionStorage } from "../../src/sessions/memorySessionStorage";
import { UnauthorizedError } from "../../src/exceptions/httpExceptions";

describe("Memory Session Storage Test", () => {
  const STORAGE_KEY = "storageSessions";

  const getStaticMap = (): Map<string, any> =>
    (MemorySessionStorage as any)[STORAGE_KEY] as Map<string, any>;

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

  it("should starts a new session if none exists and sets an id", () => {
    const storage = new MemorySessionStorage(10_000);

    expect(storage.id()).toBeNull();

    storage.start();

    const id = storage.id();
    expect(id).toMatch(/^[a-f0-9]{64}$/);

    const map = getStaticMap();
    expect(map.has(id!)).toBe(true);

    const entry = map.get(id!);
    expect(entry.data).toEqual({});
    expect(typeof entry.expiresAt).toBe("number");
    expect(entry.expiresAt).toBe(Date.now() + 10_000);
  });

  it("should does nothing if a session is already started", () => {
    const storage = new MemorySessionStorage(10_000);

    storage.start();
    const firstId = storage.id();

    storage.start();
    const secondId = storage.id();

    expect(secondId).toBe(firstId);
    expect(getStaticMap().size).toBe(1);
  });

  it("set() auto-starts the session if none exists", () => {
    const storage = new MemorySessionStorage(10_000);

    expect(storage.id()).toBeNull();

    storage.set("foo", 123);

    expect(storage.id()).not.toBeNull();
    expect(storage.get<number>("foo")).toBe(123);
    expect(storage.has("foo")).toBe(true);
  });

  it("get() returns defaultValue if key doesn't exist", () => {
    const storage = new MemorySessionStorage(10_000);
    storage.start();

    expect(storage.get("missing")).toBeUndefined();
    expect(storage.get("missing", "fallback")).toBe("fallback");
  });

  it("remove() deletes a key when session is active", () => {
    const storage = new MemorySessionStorage(10_000);
    storage.start();

    storage.set("k", "v");
    expect(storage.has("k")).toBe(true);

    storage.remove("k");
    expect(storage.has("k")).toBe(false);
    expect(storage.get("k")).toBeUndefined();
  });

  it("remove() does nothing if no session is active", () => {
    const storage = new MemorySessionStorage(10_000);

    expect(() => storage.remove("k")).not.toThrow();
    expect(storage.id()).toBeNull();
  });

  it("destroys current session, clears data and removes from static map", () => {
    const storage = new MemorySessionStorage(10_000);
    storage.start();

    const id = storage.id()!;
    storage.set("a", 1);

    expect(getStaticMap().has(id)).toBe(true);

    storage.destroy();

    expect(storage.id()).toBeNull();
    expect(storage.get("a")).toBeUndefined();
    expect(getStaticMap().has(id)).toBe(false);
  });

  it("destroy() is safe when no session exists", () => {
    const storage = new MemorySessionStorage(10_000);

    expect(() => storage.destroy()).not.toThrow();
    expect(storage.id()).toBeNull();
    expect(getStaticMap().size).toBe(0);
  });

  it("throws UnauthorizedError if id format is invalid", () => {
    const storage = new MemorySessionStorage(10_000);

    expect(() => storage.load("not-valid")).toThrow(UnauthorizedError);
    expect(() => storage.load("not-valid")).toThrow("Invalid session");
  });

  it("throws UnauthorizedError if session does not exist", () => {
    const storage = new MemorySessionStorage(10_000);

    expect(() => storage.load(validId("b"))).toThrow(UnauthorizedError);
    expect(() => storage.load(validId("b"))).toThrow("Invalid session");
  });

  it("loads session data and refreshes expiration when not expired", () => {
    const id = validId("c");

    getStaticMap().set(id, {
      data: { userId: 99 },
      expiresAt: Date.now() + 5_000,
    });

    const storage = new MemorySessionStorage(10_000);

    storage.load(id);

    expect(storage.id()).toBe(id);
    expect(storage.get<number>("userId")).toBe(99);
    const entry = getStaticMap().get(id);
    expect(entry.expiresAt).toBe(Date.now() + 10_000);
  });

  it("does NOT load when session is expired (expiresAt <= now)", () => {
    const id = validId("d");

    getStaticMap().set(id, {
      data: { a: 1 },
      expiresAt: Date.now(),
    });

    const storage = new MemorySessionStorage(10_000);

    expect(() => storage.load(id)).not.toThrow();
    expect(storage.id()).toBeNull();
    expect(storage.get("a")).toBeUndefined();
  });

  it("removes only sessions with expiresAt < now", () => {
    const now = Date.now();

    const idExpired = validId("e");
    const idEdge = validId("f");
    const idValid = validId("1");

    getStaticMap().set(idExpired, { data: {}, expiresAt: now - 1 });
    getStaticMap().set(idEdge, { data: {}, expiresAt: now });
    getStaticMap().set(idValid, { data: {}, expiresAt: now + 1 });

    MemorySessionStorage.cleanExpiredSessions();

    const map = getStaticMap();
    expect(map.has(idExpired)).toBe(false);
    expect(map.has(idEdge)).toBe(true);
    expect(map.has(idValid)).toBe(true);
  });

  it("start() uses crypto.randomBytes(32) and returns 64 hex chars", () => {
    const spy = jest
      .spyOn(require("crypto"), "randomBytes")
      .mockImplementation(() => Buffer.alloc(32, 0xab));

    const storage = new MemorySessionStorage(10_000);
    storage.start();

    expect(spy).toHaveBeenCalledWith(32);
    expect(storage.id()).toBe("ab".repeat(32));
  });
});
