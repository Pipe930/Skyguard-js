import { verifyJWT } from "../crypto/jwt";
import { UnauthorizedError } from "../exceptions/httpExceptions";
import type { Middleware } from "../types";

/**
 * JWT authentication middleware.
 *
 * This middleware validates a Bearer token from the `Authorization` header
 * and injects the decoded JWT payload into the request state.
 *
 * Expected header format:
 *   Authorization: Bearer <token>
 *
 * Security behavior:
 * - Rejects requests with missing or malformed Authorization headers.
 * - Rejects invalid, tampered, or expired tokens.
 * - Does NOT swallow errors: always throws `UnauthorizedError`.
 *
 * Notes:
 * - This middleware assumes `verifyJWT` performs full validation
 *   (signature, expiration, and any required claims).
 * - The decoded payload is treated as trusted only after verification.
 *
 * @param secret - Secret key used to verify the JWT signature.
 * @returns Middleware that enforces JWT authentication.
 * @throws UnauthorizedError when:
 *   - Authorization header is missing
 *   - Authorization scheme is not Bearer
 *   - Token is empty
 *   - Token verification fails or token is expired
 *
 * @example
 * router.get("/profile", authJWT(secret), (request: Request) => {
 *  const user = request.state.user; // Decoded JWT payload
 * });
 */
export const authJWT = (secret: string): Middleware => {
  return async (request, next) => {
    const authHeader = request.getHeaders.authorization;

    // Validate Authorization header presence and scheme.
    if (!authHeader || !authHeader.startsWith("Bearer "))
      throw new UnauthorizedError("Missing or invalid token format");

    // Extract token from "Bearer <token>"
    const token = authHeader.split(" ")[1];
    if (!token) throw new UnauthorizedError("Token string is empty");

    // Verify token integrity and claims.
    const user = verifyJWT(token, secret);
    if (!user) throw new UnauthorizedError("Invalid or expired token");

    // Attach decoded payload to request state for downstream handlers.
    request.state.user = user;

    return await next(request);
  };
};
