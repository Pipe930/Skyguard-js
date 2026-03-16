import { cors } from "../../src/middlewares/cors";
import { createRequestMock } from "../utils";
import { HttpMethods, Response } from "../../src/http";

describe("CORS Middleware", () => {
  it("does not expose Access-Control-Allow-Origin by default", async () => {
    const middleware = cors();
    const context = await createRequestMock("/test", HttpMethods.get);

    context.req.setHeaders({
      ...context.req.headers,
      origin: "https://app.example.com",
    });

    const response = await middleware(context, () => Response.text("ok"));

    expect(response.headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("supports boolean origin callback (allow/deny)", async () => {
    const middleware = cors({
      origin: origin => origin === "https://allowed.example.com",
    });

    const allowedContext = await createRequestMock("/test", HttpMethods.get);
    allowedContext.req.setHeaders({
      ...allowedContext.req.headers,
      origin: "https://allowed.example.com",
    });

    const deniedContext = await createRequestMock("/test", HttpMethods.get);
    deniedContext.req.setHeaders({
      ...deniedContext.req.headers,
      origin: "https://denied.example.com",
    });

    const allowedResponse = await middleware(allowedContext, () =>
      Response.text("ok"),
    );
    const deniedResponse = await middleware(deniedContext, () =>
      Response.text("ok"),
    );

    expect(allowedResponse.headers["Access-Control-Allow-Origin"]).toBe(
      "https://allowed.example.com",
    );
    expect(deniedResponse.headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("reflects origin when using wildcard with credentials", async () => {
    const middleware = cors({
      origin: "*",
      credentials: true,
    });

    const context = await createRequestMock("/test", HttpMethods.get);
    context.req.setHeaders({
      ...context.req.headers,
      origin: "https://secure.example.com",
    });

    const response = await middleware(context, () => Response.text("ok"));

    expect(response.headers["Access-Control-Allow-Origin"]).toBe(
      "https://secure.example.com",
    );
    expect(response.headers["Access-Control-Allow-Credentials"]).toBe("true");
    expect(response.headers.Vary).toBe("Origin");
  });

  it("handles preflight and returns 204 by default", async () => {
    const middleware = cors({
      origin: ["https://app.example.com"],
      allowedHeaders: ["Authorization"],
    });

    const context = await createRequestMock("/test", HttpMethods.options);
    context.req.setHeaders({
      ...context.req.headers,
      origin: "https://app.example.com",
    });

    const next = jest.fn(() => Response.text("should-not-run"));
    const response = await middleware(context, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(204);
    expect(response.headers["Access-Control-Allow-Origin"]).toBe(
      "https://app.example.com",
    );
    expect(response.headers["Access-Control-Allow-Headers"]).toBe(
      "Authorization",
    );
  });
});
