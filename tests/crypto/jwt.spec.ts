import { createJWT, verifyJWT, decodeJWT } from "../../src/crypto/jwt";

describe("JWT core behaviour", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-21T00:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const secret = "super-secret";
  const payload = { sub: "user_123", role: "admin" };

  it("createJWT() creates token with header/payload/signature and sets iat/exp", () => {
    const token = createJWT(payload, secret, 60);
    const decoded = decodeJWT(token);
    const now = Math.floor(Date.now() / 1000);

    expect(token.split(".")).toHaveLength(3);
    expect(decoded.header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(decoded.payload.iat).toBe(now);
    expect(decoded.payload.exp).toBe(now + 60);
    expect(decoded.payload.sub).toBe("user_123");
  });

  it("verifyJWT() returns payload when valid", () => {
    const token = createJWT(payload, secret, 60);
    const verified = verifyJWT(token, secret);

    expect(verified).not.toBeNull();
    expect(verified.sub).toBe("user_123");
  });

  it("verifyJWT() returns null when token format is invalid", () => {
    expect(verifyJWT("abc", secret)).toBeNull();
    expect(verifyJWT("a.b", secret)).toBeNull();
    expect(verifyJWT("a.b.c.d", secret)).toBeNull();
  });

  it("verifyJWT() returns null when payload is tampered (same signature length)", () => {
    const token = createJWT(payload, secret, 60);
    const [h, p, s] = token.split(".");
    const tamperedPayload = p.slice(0, -1) + (p.slice(-1) === "A" ? "B" : "A");
    const tampered = `${h}.${tamperedPayload}.${s}`;

    expect(verifyJWT(tampered, secret)).toBeNull();
  });

  it("verifyJWT() returns null when secret is wrong", () => {
    const token = createJWT(payload, secret, 60);
    expect(verifyJWT(token, "wrong-secret")).toBeNull();
  });

  it("verifyJWT() returns null when expired", () => {
    const token = createJWT(payload, secret, 1);
    jest.setSystemTime(new Date("2026-02-21T00:00:02.000Z"));
    expect(verifyJWT(token, secret)).toBeNull();
  });

  it("verifyJWT() returns null when payload has no exp (implementation requires exp)", () => {
    const token = createJWT(payload, secret);
    expect(verifyJWT(token, secret)).toBeNull();
  });

  it("decodeJWT() decodes even if signature is invalid", () => {
    const token = createJWT(payload, secret, 60);
    const [h, p] = token.split(".");
    const fake = `${h}.${p}.invalidsig`;
    const decoded = decodeJWT(fake);

    expect(decoded).not.toBeNull();
    expect(decoded.payload.sub).toBe("user_123");
  });
});
