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
 * Codifica en Base64URL (sin padding)
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Decodifica desde Base64URL
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * Crea un JSON Web Token
 * @param payload - Datos a incluir en el token
 * @param secret - Clave secreta para firmar
 * @param expiresIn - Tiempo de expiración en segundos (opcional)
 * @returns JWT string
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

  // Retornar JWT completo
  return `${data}.${signature}`;
};

/**
 * Verifica y decodifica un JSON Web Token
 * @param token - JWT a verificar
 * @param secret - Clave secreta usada para firmar
 * @returns Payload decodificado o null si es inválido
 */
export const verifyJWT = (token: string, secret: string): JWTPayload | null => {
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

  const signatureBuffer = Buffer.from(signature!);
  const computedBuffer = Buffer.from(expectedSignature);

  if (!timingSafeEqual(signatureBuffer, computedBuffer)) return null;

  try {
    const payload: JWTPayload = JSON.parse(base64UrlDecode(encodedPayload));

    if (!payload.exp) return null;

    const now = Math.floor(Date.now() / 1000);
    if (now > payload.exp) return null;

    return payload;
  } catch (error) {
    return null;
  }
};

/**
 * Decodifica un JWT sin verificar la firma (útil para debugging)
 * @param token - JWT a decodificar
 * @returns Objeto con header y payload decodificados
 */
export const decodeJWT = (
  token: string,
): { header: JWTHeader; payload: JWTPayload } | null => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));

    return { header, payload };
  } catch (error) {
    return null;
  }
};
