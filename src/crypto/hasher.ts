import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

type ScryptOptions = {
  cost: number; // N (CPU/memory cost)
  blockSize: number; // r
  parallelization: number; // p
  maxmem?: number;
};

/**
 * Derives password keys using Node.js `crypto.scrypt` but exposed as a Promise.
 *
 * Why the cast?
 * `crypto.scrypt` has multiple overloads (with/without `options`). When wrapped with
 * `util.promisify`, TypeScript often keeps only the 3-argument overload and “forgets”
 * the one that accepts `options`. We re-type it to preserve the 4-argument signature.
 *
 * @param password - Plaintext password (or Buffer) to derive from.
 * @param salt - Random per-password salt (or Buffer).
 * @param keylen - Desired derived key length in bytes (e.g., 64).
 * @param options - Scrypt work-factor parameters (cost, blockSize, parallelization, maxmem).
 * @returns The derived key as a Buffer.
 */
const scryptAsync = promisify(scrypt) as unknown as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

// Reasonable defaults (tune cost by measuring ~100–250ms on your server).
const DEFAULT_PARAMS: ScryptOptions = {
  cost: 16384,
  blockSize: 8,
  parallelization: 1,
  maxmem: 64 * 1024 * 1024,
};

/**
 * Parsed representation of a stored password hash.
 *
 * Format:
 *   scrypt$<cost>$<blockSize>$<parallelization>$<saltHex>$<hashHex>
 */
interface ParsedHash {
  cost: number;
  blockSize: number;
  parallelization: number;
  salt: string;
  hash: string;
  keyLength: number;
}

const isHex = (s: string): boolean => /^[0-9a-f]+$/i.test(s);
const isPositiveInt = (n: number): boolean => Number.isInteger(n) && n > 0;

/**
 * Parses a compact scrypt password hash string into its components.
 *
 * Expected format:
 *   `scrypt$<cost>$<blockSize>$<parallelization>$<saltHex>$<hashHex>`
 *
 * @param hash - Stored hash string in compact format.
 * @returns Parsed fields or `null` if the string is invalid.
 */
const parseHash = (hash: string): ParsedHash | null => {
  try {
    const parts = hash.split("$");
    if (parts.length !== 6) return null;

    const [algo, costStr, blockSizeStr, parallelStr, saltHex, hashHex] = parts;
    if (algo !== "scrypt") return null;

    const cost = Number(costStr);
    const blockSize = Number(blockSizeStr);
    const parallelization = Number(parallelStr);

    if (
      !isPositiveInt(cost) ||
      !isPositiveInt(blockSize) ||
      !isPositiveInt(parallelization)
    )
      return null;
    if (!saltHex || !hashHex) return null;
    if (!isHex(saltHex) || !isHex(hashHex)) return null;
    if (saltHex.length % 2 !== 0 || hashHex.length % 2 !== 0) return null;
    if (saltHex.length < 32) return null;

    const hashBuffer = Buffer.from(hashHex, "hex");
    if (hashBuffer.length === 0) return null;

    return {
      cost,
      blockSize,
      parallelization,
      salt: saltHex,
      hash: hashHex,
      keyLength: hashBuffer.length,
    };
  } catch {
    return null;
  }
};

/**
 * Hashes a plaintext password using scrypt with an unique random salt.
 *
 * Output format:
 *   `scrypt$<cost>$<blockSize>$<parallelization>$<saltHex>$<hashHex>`
 *
 * @param password - Plaintext password.
 * @param saltLength - Salt length in bytes. Default `16` (recommended minimum).
 * @param params - Scrypt work-factor params. Defaults to `DEFAULT_PARAMS`.
 * @param pepper - Optional server secret mixed into the password (e.g., from env var).
 * @returns A compact encoded hash string containing algorithm parameters + salt + derived key.
 *
 * @example
 * const passwordHash = await hash("password", 16);
 */
export const hash = async (
  password: string,
  saltLength = 16,
  params: ScryptOptions = DEFAULT_PARAMS,
  pepper?: string,
): Promise<string> => {
  const salt = randomBytes(saltLength);
  const pwd = pepper ? password + pepper : password;

  const derived = await scryptAsync(pwd, salt, KEY_LENGTH, {
    cost: params.cost,
    blockSize: params.blockSize,
    parallelization: params.parallelization,
    ...(params.maxmem ? { maxmem: params.maxmem } : {}),
  });

  return `scrypt$${params.cost}$${params.blockSize}$${params.parallelization}$${salt.toString(
    "hex",
  )}$${derived.toString("hex")}`;
};

/**
 * Verifies a plaintext password against a stored scrypt hash string.
 *
 * Safe failure behavior:
 * - Returns `false` for any parsing error, invalid encoding, mismatched lengths,
 *   or scrypt errors. This avoids leaking details about why verification failed.
 *
 * @param password - Plaintext password to verify.
 * @param storedHash - Stored hash string in the compact format.
 * @param pepper - Optional server secret; must match the one used when hashing.
 * @returns `true` if the password matches, otherwise `false`.
 *
 * @example
 * const validPassword = await verify("password", "passwordHashed");
 */
export const verify = async (
  password: string,
  storedHash: string,
  pepper?: string,
): Promise<boolean> => {
  const parsed = parseHash(storedHash);
  if (!parsed) return false;

  try {
    const pwd = pepper ? password + pepper : password;

    const derived = await scryptAsync(
      pwd,
      Buffer.from(parsed.salt, "hex"),
      parsed.keyLength,
      {
        cost: parsed.cost,
        blockSize: parsed.blockSize,
        parallelization: parsed.parallelization,
      },
    );

    const storedBuffer = Buffer.from(parsed.hash, "hex");
    if (storedBuffer.length !== derived.length) return false;

    return timingSafeEqual(derived, storedBuffer);
  } catch {
    return false;
  }
};

/**
 * Indicates whether a stored hash should be regenerated using the current parameters.
 *
 * Use this after successful login:
 * - If `needsRehash(...) === true`, compute a new hash using `hash(...)` with
 *   the latest parameters and store it back to the DB.
 *
 * This enables gradual upgrades of the work factor without forcing password resets.
 *
 * @param storedHash - Stored hash string in compact format.
 * @param params - Desired/current scrypt params. Defaults to `DEFAULT_PARAMS`.
 * @returns `true` if the hash is missing/invalid or was produced with different parameters.
 *
 * @example
 * const passwordRehash = needsRehash("passwordHashed");
 */
export const needsRehash = (
  storedHash: string,
  params: ScryptOptions = DEFAULT_PARAMS,
): boolean => {
  const parsed = parseHash(storedHash);
  if (!parsed) return true;

  return (
    parsed.keyLength !== KEY_LENGTH ||
    parsed.cost !== params.cost ||
    parsed.blockSize !== params.blockSize ||
    parsed.parallelization !== params.parallelization
  );
};

/**
 * Simple concurrency limiter for CPU-heavy hashing/verifying.
 */
const mapLimit = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results = new Array(items.length) as R[];
  let idx = 0;

  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) break;
      results[i] = await fn(items[i], i);
    }
  });

  await Promise.all(workers);
  return results;
};

/**
 * Hashes multiple passwords using controlled concurrency.
 *
 * Why limit concurrency?
 * scrypt is intentionally CPU + memory intensive. Running too many in parallel can:
 * - saturate the libuv threadpool,
 * - exceed memory limits (especially in containers),
 * - increase latency for the rest of the application.
 *
 * The `concurrency` option caps the number of simultaneous scrypt operations.
 *
 * @param passwords - List of plaintext passwords.
 * @param options - Optional hashing controls:
 *   - saltLength: salt bytes (default 16)
 *   - params: scrypt params (default DEFAULT_PARAMS)
 *   - pepper: optional server secret
 *   - concurrency: max simultaneous operations (default 4)
 * @returns Array of compact hash strings in the same order as input.
 *
 * @example
 *
 * const listPasswords = ["password1", "password2", "password3"];
 * const passwordsHasherList = await hashBatch(listPasswords, 16);
 */
export const hashBatch = async (
  passwords: string[],
  saltLength = 16,
  concurrency = 4,
  params: ScryptOptions = DEFAULT_PARAMS,
  pepper?: string,
): Promise<string[]> => {
  return mapLimit(passwords, concurrency, password =>
    hash(password, saltLength, params, pepper),
  );
};

/**
 * Verifies multiple password/hash pairs using controlled concurrency.
 *
 * This is useful for bulk checks or migrations. Concurrency is typically higher
 * than hashing, but still should be bounded to avoid saturating the threadpool.
 *
 * @param credentials - Array of `{ password, hash }` pairs.
 * @param options - Optional verification controls:
 *   - pepper: optional server secret
 *   - concurrency: max simultaneous operations (default 8)
 * @returns Array of booleans in the same order as input.
 *
 * @example
 * const verifyPasswords = await verifyBatch([{ password: "test", hash: "testHash" }, { password: "test2", hash: "testHash2" }]);
 */
export const verifyBatch = async (
  credentials: Array<{ password: string; hash: string }>,
  concurrency = 8,
  pepper?: string,
): Promise<boolean[]> => {
  return mapLimit(credentials, concurrency, credential =>
    verify(credential.password, credential.hash, pepper),
  );
};
