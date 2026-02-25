jest.mock("node:crypto", () => {
  const actual =
    jest.requireActual<typeof import("node:crypto")>("node:crypto");
  return {
    ...actual,
    randomBytes: jest.fn(),
    scrypt: jest.fn(),
    timingSafeEqual: actual.timingSafeEqual,
  };
});

import { randomBytes, scrypt } from "node:crypto";
import * as hasher from "../../src/crypto/hasher";

const randomBytesMock = randomBytes as jest.Mock;
const scryptMock = scrypt as jest.Mock;

describe("Hasher Test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const buildStoredHash = (opts: {
    cost?: number;
    blockSize?: number;
    parallelization?: number;
    saltHex: string;
    hashHex: string;
  }) => {
    const cost = opts.cost ?? 16384;
    const blockSize = opts.blockSize ?? 8;
    const parallelization = opts.parallelization ?? 1;

    return `scrypt$${cost}$${blockSize}$${parallelization}$${opts.saltHex}$${opts.hashHex}`;
  };

  const mockScryptOk = (derived: Buffer) => {
    scryptMock.mockImplementation(
      (
        _pwd: string | Buffer,
        _salt: string | Buffer,
        _keylen: number,
        _options: any,
        cb: (err: Error | null, derivedKey: Buffer) => void,
      ) => cb(null, derived),
    );
  };

  const mockScryptFail = () => {
    scryptMock.mockImplementation(
      (
        _pwd: string | Buffer,
        _salt: string | Buffer,
        _keylen: number,
        _options: any,
        cb: (err: Error | null, derivedKey?: Buffer) => void,
      ) => cb(new Error("boom")),
    );
  };

  describe("hash()", () => {
    it("returns compact formatted hash and uses pepper", async () => {
      const salt = Buffer.from("11".repeat(16), "hex");
      const derived = Buffer.from("22".repeat(32), "hex");

      randomBytesMock.mockReturnValue(salt);
      mockScryptOk(derived);

      const out = await hasher.hash(
        "password",
        16,
        { cost: 1, blockSize: 2, parallelization: 3 } as any,
        "pep",
      );

      expect(out).toBe(
        `scrypt$1$2$3$${salt.toString("hex")}$${derived.toString("hex")}`,
      );

      expect(scryptMock).toHaveBeenCalledWith(
        "passwordpep",
        salt,
        expect.any(Number),
        expect.objectContaining({ cost: 1, blockSize: 2, parallelization: 3 }),
        expect.any(Function),
      );
    });
  });

  describe("verify()", () => {
    it("returns TRUE for correct password", async () => {
      const saltHex = "aa".repeat(16);
      const hashHex = "bb".repeat(32);
      const stored = buildStoredHash({
        saltHex,
        hashHex,
        cost: 1,
        blockSize: 2,
        parallelization: 3,
      });

      mockScryptOk(Buffer.from(hashHex, "hex"));

      const ok = await hasher.verify("pass", stored);
      expect(ok).toBe(true);
    });

    it("returns FALSE for wrong password", async () => {
      const saltHex = "aa".repeat(16);
      const hashHex = "bb".repeat(32);
      const stored = buildStoredHash({ saltHex, hashHex });

      mockScryptOk(Buffer.from("cc".repeat(32), "hex"));

      const ok = await hasher.verify("pass", stored);
      expect(ok).toBe(false);
    });

    it("fails safely when hash is invalid", async () => {
      const ok = await hasher.verify("pass", "invalid-hash");
      expect(ok).toBe(false);
      expect(scryptMock).not.toHaveBeenCalled();
    });

    it("fails safely when scrypt throws", async () => {
      const saltHex = "aa".repeat(16);
      const hashHex = "bb".repeat(32);
      const stored = buildStoredHash({ saltHex, hashHex });

      mockScryptFail();

      const ok = await hasher.verify("pass", stored);
      expect(ok).toBe(false);
    });
  });

  describe("needsRehash()", () => {
    it("returns TRUE for invalid hash", () => {
      expect(hasher.needsRehash("invalid")).toBe(true);
    });

    it("returns TRUE when params changed", () => {
      const hashHex = "bb".repeat(64);
      const stored = buildStoredHash({
        saltHex: "aa".repeat(16),
        hashHex,
        cost: 1,
        blockSize: 2,
        parallelization: 3,
      });

      expect(
        hasher.needsRehash(stored, {
          cost: 9,
          blockSize: 2,
          parallelization: 3,
        } as any),
      ).toBe(true);
    });

    it("returns FALSE when params match (and keyLength matches)", () => {
      const hashHex = "bb".repeat(64);
      const params = (hasher as any).DEFAULT_PARAMS ?? {
        cost: 16384,
        blockSize: 8,
        parallelization: 1,
      };

      const stored = buildStoredHash({
        saltHex: "aa".repeat(16),
        hashHex,
        cost: params.cost,
        blockSize: params.blockSize,
        parallelization: params.parallelization,
      });

      expect(hasher.needsRehash(stored, params)).toBe(false);
    });
  });

  describe("batch helpers", () => {
    it("hashBatch preserves order", async () => {
      jest.spyOn(hasher, "hash").mockImplementation(async p => `H(${p})`);
      const out = await hasher.hashBatch(["a", "b", "c"], { concurrency: 2 });
      expect(out).toEqual(["H(a)", "H(b)", "H(c)"]);
    });

    it("verifyBatch preserves order", async () => {
      jest.spyOn(hasher, "verify").mockImplementation(async p => p === "ok");
      const out = await hasher.verifyBatch([
        { password: "ok", hash: "h" },
        { password: "no", hash: "h" },
      ]);
      expect(out).toEqual([true, false]);
    });
  });
});
