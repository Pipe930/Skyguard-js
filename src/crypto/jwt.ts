import { createHmac, timingSafeEqual } from "node:crypto";

interface JWTPayload {
  [key: string]: any;
  exp?: number;
  iat?: number;
}

interface JWTHeader {
  alg: string;
  typ: string;
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
 */
export const createJWT = (
  payload: JWTPayload,
  secret: string,
  expiresIn?: number,
): string => {
  const header: JWTHeader = {
    alg: "HS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const tokenPayload: JWTPayload = {
    ...payload,
    iat: now,
  };

  if (expiresIn) tokenPayload.exp = now + expiresIn;

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));

  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${data}.${signature}`;
};

/**
 * Verifies the integrity and validity of a JSON Web Token.
 *
 * If any validation step fails, the function returns `null`.
 *
 * @param token - JWT string to verify.
 * @param secret - Secret used to sign the token.
 * @returns Decoded payload if the token is valid, otherwise `null`.
 */
export const verifyJWT = (token: string, secret: string): JWTPayload | null => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;

    const data = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = createHmac("sha256", secret)
      .update(data)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    const signatureBuffer = Buffer.from(signature);
    const computedBuffer = Buffer.from(expectedSignature);

    if (signatureBuffer.length !== computedBuffer.length) return null;
    if (!timingSafeEqual(signatureBuffer, computedBuffer)) return null;

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
