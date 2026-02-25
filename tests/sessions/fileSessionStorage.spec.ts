import { FileSessionStorage } from "../../src/sessions/fileSessionStorage";
import {
  UnauthorizedError,
  InternalServerError,
} from "../../src/exceptions/httpExceptions";
import {
  readFile,
  writeFile,
  unlink,
  mkdir,
  readdir,
  rename,
} from "fs/promises";
import { randomBytes } from "crypto";
import { join } from "path";
import { SessionData } from "sessions/sessionStorage";

jest.mock("fs/promises");
jest.mock("crypto");
jest.mock("path");

describe("FileSessionStorage", () => {
  let storage: FileSessionStorage;
  const mockStoragePath = "/tmp/test-sessions";
  const mockExpiredSession = 3600;
  const mockSessionId = "a".repeat(64);

  beforeEach(() => {
    jest.clearAllMocks();
    storage = new FileSessionStorage(mockExpiredSession, mockStoragePath);

    jest.spyOn(Date, "now").mockReturnValue(1000000);
    (join as jest.Mock).mockImplementation((...args) => args.join("/"));
    (randomBytes as jest.Mock).mockReturnValue({
      toString: () => mockSessionId,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should load valid existing session", async () => {
    const sessionData = {
      data: { userId: "123", username: "test" },
      expiresAt: Date.now() + 10000,
    };

    (readFile as jest.Mock).mockResolvedValue(JSON.stringify(sessionData));
    (mkdir as jest.Mock).mockResolvedValue(undefined);
    (writeFile as jest.Mock).mockResolvedValue(undefined);
    (rename as jest.Mock).mockResolvedValue(undefined);

    await storage.load(mockSessionId);

    expect(storage.id()).toBe(mockSessionId);
    expect(storage.get("userId")).toBe("123");
  });

  it("should throw UnauthorizedError for invalid session ID", async () => {
    await expect(storage.load("invalid-id")).rejects.toThrow(UnauthorizedError);
    await expect(storage.load("G".repeat(64))).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("should throw UnauthorizedError for expired session", async () => {
    const expiredSession = {
      data: { userId: "123" },
      expiresAt: Date.now() - 1000,
    };

    (readFile as jest.Mock).mockResolvedValue(JSON.stringify(expiredSession));
    (unlink as jest.Mock).mockResolvedValue(undefined);

    await expect(storage.load(mockSessionId)).rejects.toThrow(
      UnauthorizedError,
    );
    expect(unlink).toHaveBeenCalled();
  });

  it("should renew TTL on load (sliding expiration)", async () => {
    const sessionData = {
      data: { userId: "123" },
      expiresAt: Date.now() + 10000,
    };

    (readFile as jest.Mock).mockResolvedValue(JSON.stringify(sessionData));
    (mkdir as jest.Mock).mockResolvedValue(undefined);
    (writeFile as jest.Mock).mockResolvedValue(undefined);
    (rename as jest.Mock).mockResolvedValue(undefined);

    await storage.load(mockSessionId);

    expect(writeFile).toHaveBeenCalled();
    const savedData = JSON.parse(
      (writeFile as jest.Mock).mock.calls[0]?.[1] as string,
    ) as SessionData;
    expect(savedData.expiresAt).toBe(Date.now() + mockExpiredSession * 1000);
  });

  describe("start", () => {
    beforeEach(() => {
      (mkdir as jest.Mock).mockResolvedValue(undefined);
      (writeFile as jest.Mock).mockResolvedValue(undefined);
      (rename as jest.Mock).mockResolvedValue(undefined);
    });

    it("should start new session", async () => {
      await storage.start();

      expect(storage.id()).toBe(mockSessionId);
      expect(mkdir).toHaveBeenCalledWith(mockStoragePath, { recursive: true });
    });

    it("should not start if session already exists", async () => {
      await storage.start();
      jest.clearAllMocks();

      await storage.start();

      expect(mkdir).not.toHaveBeenCalled();
    });

    it("should assign ID before async I/O", async () => {
      let idBeforeIO: string | null = null;

      (mkdir as jest.Mock).mockImplementation(() => {
        idBeforeIO = storage.id();
      });

      await storage.start();

      expect(idBeforeIO).toBe(mockSessionId);
    });
  });

  describe("get/set", () => {
    beforeEach(() => {
      (mkdir as jest.Mock).mockResolvedValue(undefined);
      (writeFile as jest.Mock).mockResolvedValue(undefined);
      (rename as jest.Mock).mockResolvedValue(undefined);
    });

    it("should return undefined for non-existent keys", () => {
      expect(storage.get("nonexistent")).toBeUndefined();
    });

    it("should return default value when key does not exist", () => {
      expect(storage.get("nonexistent", "default")).toBe("default");
    });

    it("should store and retrieve values", async () => {
      await storage.set("key", "value");

      expect(storage.get("key")).toBe("value");
      expect(writeFile).toHaveBeenCalled();
    });

    it("should auto-start session on set", async () => {
      expect(storage.id()).toBeNull();

      await storage.set("key", "value");

      expect(storage.id()).toBe(mockSessionId);
    });

    it("should handle different data types", async () => {
      await storage.set("string", "test");
      await storage.set("number", 42);
      await storage.set("object", { nested: "value" });

      expect(storage.get("string")).toBe("test");
      expect(storage.get("number")).toBe(42);
      expect(storage.get("object")).toEqual({ nested: "value" });
    });
  });

  describe("remove", () => {
    beforeEach(() => {
      (mkdir as jest.Mock).mockResolvedValue(undefined);
      (writeFile as jest.Mock).mockResolvedValue(undefined);
      (rename as jest.Mock).mockResolvedValue(undefined);
    });

    it("should remove key and persist", async () => {
      await storage.set("key", "value");
      expect(storage.has("key")).toBe(true);

      await storage.remove("key");

      expect(storage.has("key")).toBe(false);
    });

    it("should do nothing if session not started", async () => {
      await storage.remove("key");

      expect(writeFile).not.toHaveBeenCalled();
    });
  });

  describe("destroy", () => {
    beforeEach(() => {
      (mkdir as jest.Mock).mockResolvedValue(undefined);
      (writeFile as jest.Mock).mockResolvedValue(undefined);
      (rename as jest.Mock).mockResolvedValue(undefined);
      (unlink as jest.Mock).mockResolvedValue(undefined);
    });

    it("should destroy session and clear state", async () => {
      await storage.set("key", "value");

      await storage.destroy();

      expect(storage.id()).toBeNull();
      expect(storage.has("key")).toBe(false);
      expect(unlink).toHaveBeenCalled();
    });

    it("should handle file deletion errors gracefully", async () => {
      await storage.start();
      (unlink as jest.Mock).mockRejectedValue(new Error("Delete failed"));

      await expect(storage.destroy()).resolves.not.toThrow();
    });
  });

  describe("all", () => {
    beforeEach(() => {
      (mkdir as jest.Mock).mockResolvedValue(undefined);
      (writeFile as jest.Mock).mockResolvedValue(undefined);
      (rename as jest.Mock).mockResolvedValue(undefined);
    });

    it("should return empty object when no data", () => {
      expect(storage.all()).toEqual({});
    });

    it("should return shallow copy of all session data", async () => {
      await storage.set("key1", "value1");
      await storage.set("key2", "value2");

      const allData = storage.all();

      expect(allData).toEqual({ key1: "value1", key2: "value2" });
      allData["newKey"] = "newValue";
      expect(storage.has("newKey")).toBe(false);
    });
  });

  it("should delete expired sessions", async () => {
    const files = ["sess_abc.json", "sess_def.json"];
    const expiredSession = { expiresAt: Date.now() - 1000 };
    const validSession = { expiresAt: Date.now() + 10000 };

    (readdir as jest.Mock).mockResolvedValue(files);
    (readFile as jest.Mock)
      .mockResolvedValueOnce(JSON.stringify(expiredSession))
      .mockResolvedValueOnce(JSON.stringify(validSession));
    (unlink as jest.Mock).mockResolvedValue(undefined);

    await FileSessionStorage.cleanExpiredSessions(mockStoragePath);

    expect(unlink).toHaveBeenCalledTimes(1);
  });

  it("should delete corrupted files", async () => {
    const files = ["sess_abc.json"];

    (readdir as jest.Mock).mockResolvedValue(files);
    (readFile as jest.Mock).mockResolvedValue("invalid json");
    (unlink as jest.Mock).mockResolvedValue(undefined);

    await FileSessionStorage.cleanExpiredSessions(mockStoragePath);

    expect(unlink).toHaveBeenCalledTimes(1);
  });

  it("should handle directory read errors", async () => {
    (readdir as jest.Mock).mockRejectedValue(new Error("Dir not found"));

    await expect(
      FileSessionStorage.cleanExpiredSessions(mockStoragePath),
    ).resolves.not.toThrow();
  });

  it("should use atomic write (tmp + rename)", async () => {
    (mkdir as jest.Mock).mockResolvedValue(undefined);
    (writeFile as jest.Mock).mockResolvedValue(undefined);
    (rename as jest.Mock).mockResolvedValue(undefined);

    await storage.set("key", "value");

    const writeFileCalls = (writeFile as jest.Mock).mock.calls;
    const renameCalls = (rename as jest.Mock).mock.calls;

    expect(writeFileCalls[0][0]).toContain(".tmp");
    expect(renameCalls[0][0]).toContain(".tmp");
    expect(renameCalls[0][1]).not.toContain(".tmp");
  });

  it("should throw InternalServerError on persistence failure", async () => {
    (mkdir as jest.Mock).mockResolvedValue(undefined);
    (writeFile as jest.Mock).mockRejectedValue(new Error("Write failed"));
    (unlink as jest.Mock).mockResolvedValue(undefined);

    await expect(storage.set("key", "value")).rejects.toThrow(
      InternalServerError,
    );
  });

  describe("Integration scenarios", () => {
    beforeEach(() => {
      (mkdir as jest.Mock).mockResolvedValue(undefined);
      (writeFile as jest.Mock).mockResolvedValue(undefined);
      (rename as jest.Mock).mockResolvedValue(undefined);
      (unlink as jest.Mock).mockResolvedValue(undefined);
    });

    it("should handle complete session workflow", async () => {
      await storage.start();
      await storage.set("userId", "123");
      await storage.set("username", "testuser");

      expect(storage.get("userId")).toBe("123");
      expect(storage.all()).toEqual({
        userId: "123",
        username: "testuser",
      });

      await storage.set("userId", "456");
      expect(storage.get("userId")).toBe("456");

      await storage.remove("username");
      expect(storage.has("username")).toBe(false);

      await storage.destroy();
      expect(storage.id()).toBeNull();
    });
  });
});
