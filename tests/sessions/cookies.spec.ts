import { parseCookies } from "../../src/sessions/cookies";

describe("Cookies parser", () => {
  it("ignores malformed URI encodings without throwing", () => {
    expect(() => parseCookies("bad=%E0%A4%A; ok=value")).not.toThrow();
    expect(parseCookies("bad=%E0%A4%A; ok=value")).toEqual({
      bad: "%E0%A4%A",
      ok: "value",
    });
  });
});
