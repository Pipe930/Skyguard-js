import {
  DatabaseSessionStorage,
  type SessionDatabaseAdapter,
} from "../../src/sessions/databaseSessionStorage";
import {
  InternalServerError,
  UnauthorizedError,
} from "../../src/exceptions/httpExceptions";

describe("Database Session Storage Test", () => {
  const validId = (ch = "a") => ch.repeat(64);

  let db: jest.Mocked<SessionDatabaseAdapter>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    db = {
      findById: jest.fn(),
      upsert: jest.fn(),
      deleteById: jest.fn(),
      deleteExpired: jest.fn(),
    };

    DatabaseSessionStorage.configure(db);
  });

  afterEach(() => {
    DatabaseSessionStorage.clearAdapter();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("starts and persists a new session", async () => {
    const storage = new DatabaseSessionStorage(10);

    await storage.start();

    expect(storage.id()).toMatch(/^[a-f0-9]{64}$/);
    expect(db.upsert).toHaveBeenCalledTimes(1);
    expect(db.upsert.mock.calls[0][1]).toEqual({
      data: {},
      expiresAt: Date.now() + 10_000,
    });
  });

  it("load validates id and reads from adapter", async () => {
    const id = validId("b");
    db.findById.mockResolvedValue({
      data: { user: "john" },
      expiresAt: Date.now() + 2_000,
    });

    const storage = new DatabaseSessionStorage(10);
    await storage.load(id);

    expect(storage.id()).toBe(id);
    expect(storage.get("user")).toBe("john");
    expect(db.findById).toHaveBeenCalledWith(id);
    expect(db.upsert).toHaveBeenCalled();
  });

  it("throws unauthorized for invalid id", async () => {
    const storage = new DatabaseSessionStorage(10);

    await expect(storage.load("invalid-id")).rejects.toThrow(UnauthorizedError);
  });

  it("throws unauthorized when session is missing or expired", async () => {
    const id = validId("c");
    const storage = new DatabaseSessionStorage(10);

    db.findById.mockResolvedValue(null);
    await expect(storage.load(id)).rejects.toThrow(UnauthorizedError);

    db.findById.mockResolvedValue({ data: {}, expiresAt: Date.now() - 1 });
    await expect(storage.load(id)).rejects.toThrow("Session expired");
    expect(db.deleteById).toHaveBeenCalledWith(id);
  });

  it("set/remove/clear persist updated data", async () => {
    const storage = new DatabaseSessionStorage(10);

    await storage.set("role", "admin");
    expect(storage.get("role")).toBe("admin");

    await storage.remove("role");
    expect(storage.has("role")).toBe(false);

    await storage.set("x", 1);
    await storage.clear();
    expect(storage.all()).toEqual({});

    expect(db.upsert).toHaveBeenCalled();
  });

  it("destroy and regenerate lifecycle", async () => {
    const storage = new DatabaseSessionStorage(10);
    await storage.set("userId", 1);

    const previous = storage.id();
    await storage.destroy();

    expect(storage.id()).toBeNull();
    expect(db.deleteById).toHaveBeenCalledWith(previous);

    await storage.set("persist", true);
    const afterSet = storage.id();

    await storage.regenerate();

    expect(storage.id()).not.toBe(afterSet);
    expect(storage.get("persist")).toBe(true);
  });

  it("throws InternalServerError when adapter is not configured", async () => {
    DatabaseSessionStorage.clearAdapter();
    const storage = new DatabaseSessionStorage(10);

    await expect(storage.start()).rejects.toThrow(InternalServerError);
  });

  it("cleans expired sessions through adapter", async () => {
    await DatabaseSessionStorage.cleanExpiredSessions(1234);
    expect(db.deleteExpired).toHaveBeenCalledWith(1234);
  });
});
