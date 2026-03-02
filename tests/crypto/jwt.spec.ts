import { JWT } from "../../src/crypto/jwt";

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

  it("should creates token with header/payload/signature and sets iat/exp", () => {
    const token = JWT.create(payload, secret, 60);
    const decoded = JWT.decode(token);
    const now = Math.floor(Date.now() / 1000);

    expect(token.split(".")).toHaveLength(3);
    expect(decoded.header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(decoded.payload.iat).toBe(now);
    expect(decoded.payload.exp).toBe(now + 60);
    expect(decoded.payload.sub).toBe("user_123");
  });

  it("should returns payload when valid", () => {
    const token = JWT.create(payload, secret, 60);
    const verified = JWT.verify(token, secret);

    expect(verified).not.toBeNull();
    expect(verified.sub).toBe("user_123");
  });

  it("should returns null when token format is invalid", () => {
    expect(JWT.verify("abc", secret)).toBeNull();
    expect(JWT.verify("a.b", secret)).toBeNull();
    expect(JWT.verify("a.b.c.d", secret)).toBeNull();
  });

  it("should returns null when payload is tampered (same signature length)", () => {
    const token = JWT.create(payload, secret, 60);
    const [h, p, s] = token.split(".");
    const tamperedPayload = p.slice(0, -1) + (p.slice(-1) === "A" ? "B" : "A");
    const tampered = `${h}.${tamperedPayload}.${s}`;

    expect(JWT.verify(tampered, secret)).toBeNull();
  });

  it("should returns null when secret is wrong", () => {
    const token = JWT.create(payload, secret, 60);
    expect(JWT.verify(token, "wrong-secret")).toBeNull();
  });

  it("should returns null when expired", () => {
    const token = JWT.create(payload, secret, 1);
    jest.setSystemTime(new Date("2026-02-21T00:00:02.000Z"));
    expect(JWT.verify(token, secret)).toBeNull();
  });

  it("should returns null when payload has no exp (implementation requires exp)", () => {
    const token = JWT.create(payload, secret);
    expect(JWT.verify(token, secret)).toBeNull();
  });

  it("should returns null (and does not throw) when signature length is invalid", () => {
    expect(() => JWT.verify("a.b.short", "secret")).not.toThrow();
    expect(JWT.verify("a.b.short", "secret")).toBeNull();
  });

  it("decodeJWT() decodes even if signature is invalid", () => {
    const token = JWT.create(payload, secret, 60);
    const [h, p] = token.split(".");
    const fake = `${h}.${p}.invalidsig`;
    const decoded = JWT.decode(fake);

    expect(decoded).not.toBeNull();
    expect(decoded.payload.sub).toBe("user_123");
  });
});
