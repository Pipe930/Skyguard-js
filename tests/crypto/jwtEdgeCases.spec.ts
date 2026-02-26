import { verifyJWT } from "../../src/crypto/jwt";

describe("JWT edge cases", () => {
  it("verifyJWT() returns null (and does not throw) when signature length is invalid", () => {
    expect(() => verifyJWT("a.b.short", "secret")).not.toThrow();
    expect(verifyJWT("a.b.short", "secret")).toBeNull();
  });
});
