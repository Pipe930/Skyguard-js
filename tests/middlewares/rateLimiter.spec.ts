import { createRequestMock } from "../utils";
import { HttpMethods, Response } from "../../src/http";
import {
  type RateLimitStore,
  type RateLimitStoreEntry,
  rateLimit,
} from "../../src/middlewares/rateLimiter";

describe("Rate Limiter Middleware", () => {
  it("ignores spoofed proxy headers when trustProxy is false", async () => {
    const middleware = rateLimit({
      windowMs: 60_000,
      max: 1,
      trustProxy: false,
    });

    const firstContext = await createRequestMock("/test", HttpMethods.get);
    firstContext.req.setRemoteAddress("10.0.0.10");
    firstContext.req.setHeaders({
      ...firstContext.req.headers,
      "x-forwarded-for": "1.1.1.1",
    });

    const firstResponse = await middleware(firstContext, () => Response.text("ok"));
    expect(firstResponse.statusCode).toBe(200);

    const secondContext = await createRequestMock("/test", HttpMethods.get);
    secondContext.req.setRemoteAddress("10.0.0.10");
    secondContext.req.setHeaders({
      ...secondContext.req.headers,
      "x-forwarded-for": "2.2.2.2",
    });

    const secondResponse = await middleware(secondContext, () =>
      Response.text("ok"),
    );

    expect(secondResponse.statusCode).toBe(429);
    expect(secondResponse.headers["Retry-After"]).toBeDefined();
  });

  it("allows proxy IP keying when trustProxy is true", async () => {
    const middleware = rateLimit({
      windowMs: 60_000,
      max: 1,
      trustProxy: true,
    });

    const firstContext = await createRequestMock("/test", HttpMethods.get);
    firstContext.req.setRemoteAddress("10.0.0.10");
    firstContext.req.setHeaders({
      ...firstContext.req.headers,
      "x-forwarded-for": "1.1.1.1",
    });

    const secondContext = await createRequestMock("/test", HttpMethods.get);
    secondContext.req.setRemoteAddress("10.0.0.10");
    secondContext.req.setHeaders({
      ...secondContext.req.headers,
      "x-forwarded-for": "2.2.2.2",
    });

    const firstResponse = await middleware(firstContext, () => Response.text("ok"));
    const secondResponse = await middleware(secondContext, () =>
      Response.text("ok"),
    );

    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(200);
  });

  it("supports custom stores and periodic cleanup", async () => {
    const keyCount = new Map<string, number>();

    const store: RateLimitStore = {
      increment: jest.fn(
        (key: string, windowMs: number, now: number): RateLimitStoreEntry => {
          const count = (keyCount.get(key) ?? 0) + 1;
          keyCount.set(key, count);
          return { count, resetTime: now + windowMs };
        },
      ),
      cleanup: jest.fn(),
    };

    let now = 0;
    const nowSpy = jest.spyOn(Date, "now").mockImplementation(() => now);

    const middleware = rateLimit({
      max: 5,
      cleanupIntervalMs: 50,
      store,
      keyGenerator: () => "client-a",
    });

    now = 10;
    const firstContext = await createRequestMock("/test", HttpMethods.get);
    await middleware(firstContext, () => Response.text("ok"));

    now = 1500;
    const secondContext = await createRequestMock("/test", HttpMethods.get);
    await middleware(secondContext, () => Response.text("ok"));

    expect(store.increment).toHaveBeenCalledTimes(2);
    expect(store.cleanup).toHaveBeenCalledTimes(1);

    nowSpy.mockRestore();
  });
});
