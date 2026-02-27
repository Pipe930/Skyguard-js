import { BaseException } from "../exceptions/baseException";
import {
  createHmac,
  timingSafeEqual,
  createSign,
  createVerify,
} from "node:crypto";

class JWTGeneratorException extends BaseException {
  constructor(algorithm: string) {
    super(`Unsupported algorithm: ${algorithm}`, "JWT_GENERATOR_EXCEPTION");
    this.name = "JWTGeneratorException";
  }
}

/**
 * Represents the payload (claims set) of a JSON Web Token.
 *
 * A JWT payload may contain arbitrary custom claims.
 * Common registered claims:
 * - `exp` (Expiration Time) – Unix timestamp (seconds)
 * - `iat` (Issued At) – Unix timestamp (seconds)
 *
 * Additional claims may be added depending on the application.
 */
interface JWTPayload {
  [key: string]: any;
  exp?: number;
  iat?: number;
}

/**
 * Represents the header section of a JWT.
 *
 * - `alg` – Signing algorithm used
 * - `typ` – Token type (typically `"JWT"`)
 */
interface JWTHeader {
  alg: string;
  typ: string;
}

/**
 * Supported JWT signing algorithms.
 *
 * - HS* → HMAC (symmetric secret)
 * - RS* → RSA (asymmetric public/private key)
 */
type Algorithm = "HS256" | "HS384" | "HS512" | "RS256" | "RS384" | "RS512";

/**
 * Options used when creating a JWT.
 */
interface CreateJWTOptions {
  /**
   * Signing algorithm.
   * Defaults to `"HS256"` if not provided.
   */
  algorithm?: Algorithm;

  /**
   * Token expiration:
   * - Number → seconds
   * - String → time expression (e.g. `"1h"`, `"30m"`, `"2d"`)
   */
  expiresIn?: number | string;
}

/**
 * Encodes a string using Base64URL encoding (RFC 7515).
 *
 * This format is required by JWT to ensure the token is URL-safe.
 *
 * @param str - UTF-8 string to encode.
 * @returns Base64URL encoded string without padding.
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Decodes a Base64URL string back to a UTF-8 string.
 *
 * The function restores the standard Base64 alphabet and padding
 * before performing the decoding.
 *
 * @param str - Base64URL encoded string.
 * @returns Decoded UTF-8 string.
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * Converts a Base64 string into Base64URL format.
 *
 * Used after cryptographic signing operations that return standard Base64.
 *
 * @param b64 - Standard Base64 string.
 * @returns Base64URL-compatible string.
 */
function base64ToBase64Url(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * Converts a Base64URL string into a Buffer.
 *
 * Restores Base64 padding before decoding.
 *
 * @param str - Standard Base64 string.
 * @returns Buffer data
 */
function base64UrlToBuffer(str: string): Buffer {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return Buffer.from(base64, "base64");
}

/**
 * Creates a JSON Web Token (JWT) signed using HMAC-SHA256 (HS256).
 *
 * Note:
 * This implementation produces **stateless signed tokens** and does not
 * encrypt the payload. Anyone can decode the payload, but only holders of
 * the secret can generate a valid signature.
 *
 * @param payload - Custom claims to include in the token.
 * @param secret - Secret key used to sign the token.
 * @param expiresIn - Optional expiration time in seconds.
 * @returns Signed JWT string.
 *
 * @example
 * const jwt = createJWT({ sub: "123" }, "secret", { algorithm: "HS512", expiresIn: "1h" });
 */
export const createJWT = (
  payload: JWTPayload,
  secret: string | Buffer,
  opts: number | string | CreateJWTOptions = {},
): string => {
  const options: CreateJWTOptions =
    typeof opts === "object" && opts !== null
      ? opts
      : { expiresIn: opts as number | string };

  const algorithm: Algorithm = options.algorithm ?? "HS256";

  const header: JWTHeader = {
    alg: algorithm,
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const tokenPayload: JWTPayload = {
    ...payload,
    iat: now,
  };

  if (options.expiresIn !== undefined) {
    const secs = parseExpiresIn(options.expiresIn);
    if (secs) tokenPayload.exp = now + secs;
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = signData(algorithm, data, secret);

  return `${data}.${signature}`;
};

/**
 * Verifies the signature and validity of a JWT.
 *
 * Returns `null` if validation fails at any step.
 *
 * @param token - JWT string.
 * @param secret - Secret (HMAC) or public key (RSA).
 * @returns Decoded payload if valid, otherwise `null`.
 *
 * @example
 * const verifyToken = verifyJWT("token", "secret-key");
 */
export const verifyJWT = (
  token: string,
  secret: string | Buffer,
): JWTPayload | null => {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const header = JSON.parse(base64UrlDecode(encodedHeader)) as JWTHeader;
    const alg = header.alg as Algorithm;
    const data = `${encodedHeader}.${encodedPayload}`;
    const validJWT = verifyData(alg, data, secret, signature);

    if (!validJWT) return null;

    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JWTPayload;

    if (!payload.exp) return null;

    const now = Math.floor(Date.now() / 1000);

    if (now > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
};

/**
 * Decodes a JWT without verifying its signature.
 *
 * ⚠️ Security warning:
 * This function MUST NOT be used for authentication or authorization.
 * It is intended only for debugging, logging, or inspecting token contents.
 *
 * @param token - JWT string to decode.
 * @returns Object containing decoded header and payload, or `null` if malformed.
 *
 * @example
 * conste decodeToken = decodeJWT("token");
 */
export const decodeJWT = (
  token: string,
): { header: JWTHeader; payload: JWTPayload } | null => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const header = JSON.parse(base64UrlDecode(parts[0])) as JWTHeader;
    const payload = JSON.parse(base64UrlDecode(parts[1])) as JWTPayload;

    return { header, payload };
  } catch {
    return null;
  }
};

/**
 * Parses an `expiresIn` value.
 *
 * Accepts:
 * - Number → seconds
 * - String format:
 *   - "30s"
 *   - "15m"
 *   - "2h"
 *   - "7d"
 *   - "1y"
 *
 * Returns the duration in seconds.
 *
 * @param input - Expiration value.
 * @returns Seconds or undefined if invalid.
 */
function parseExpiresIn(
  input: number | string | undefined,
): number | undefined {
  if (input === undefined) return undefined;
  if (typeof input === "number") return input;
  const match = `${input}`.trim().match(/^(\d+)\s*(s|m|h|d|y)?$/i);
  if (!match) return undefined;
  const value = parseInt(match[1], 10);
  const unit = (match[2] || "s").toLowerCase();
  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 60 * 60;
    case "d":
      return value * 60 * 60 * 24;
    case "y":
      return value * 60 * 60 * 24 * 365;
    default:
      return undefined;
  }
}

const hmacAlgorithm = (algorithm: string): string => {
  const verifyAlg =
    algorithm === "HS256"
      ? "sha256"
      : algorithm === "HS384"
        ? "sha384"
        : "sha512";
  return verifyAlg;
};

const rsaAlgorithm = (algorithm: string): string => {
  const verifyAlg =
    algorithm === "RS256"
      ? "RSA-SHA256"
      : algorithm === "RS384"
        ? "RSA-SHA384"
        : "RSA-SHA512";
  return verifyAlg;
};

/**
 * Signs JWT data using the specified algorithm.
 *
 * - HS* → HMAC (shared secret)
 * - RS* → RSA (private key)
 *
 * @param algorithm - JWT signing algorithm.
 * @param data - Header + payload.
 * @param key - Secret or private key.
 * @returns Base64URL signature string.
 */
function signData(
  algorithm: Algorithm,
  data: string,
  key: string | Buffer,
): string {
  if (algorithm.startsWith("HS")) {
    const b64 = createHmac(hmacAlgorithm(algorithm), key)
      .update(data)
      .digest("base64");
    return base64ToBase64Url(b64);
  }

  if (algorithm.startsWith("RS")) {
    const b64 = createSign(rsaAlgorithm(algorithm))
      .update(data)
      .sign(key, "base64");
    return base64ToBase64Url(b64);
  }

  throw new JWTGeneratorException(algorithm);
}

/**
 * Verifies JWT signature using constant-time comparison (HMAC)
 * or RSA verification.
 *
 * - HS* → Uses `timingSafeEqual` to prevent timing attacks.
 * - RS* → Uses Node.js `verify`.
 *
 * @param algorithm - JWT algorithm.
 * @param data - Signed data.
 * @param key - Secret or public key.
 * @param signature - Signature (Base64URL).
 * @returns `true` if signature is valid.
 */
function verifyData(
  algorithm: Algorithm,
  data: string,
  key: string | Buffer,
  signature: string,
): boolean {
  if (algorithm.startsWith("HS")) {
    const expectedB64 = createHmac(hmacAlgorithm(algorithm), key)
      .update(data)
      .digest("base64");
    const expectedBuf = base64UrlToBuffer(base64ToBase64Url(expectedB64));
    const sigBuf = base64UrlToBuffer(signature);
    if (expectedBuf.length !== sigBuf.length) return false;
    return timingSafeEqual(expectedBuf, sigBuf);
  }

  if (algorithm.startsWith("RS")) {
    const verifier = createVerify(rsaAlgorithm(algorithm)).update(data);
    const sigBuf = base64UrlToBuffer(signature);
    return verifier.verify(key, sigBuf);
  }

  return false;
}
