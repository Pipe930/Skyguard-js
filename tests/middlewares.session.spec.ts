import { sessions } from "../src/middlewares/session";
import { Request, Response } from "../src/http";
import { UnauthorizedError } from "../src/exceptions/httpExceptions";
import type { SessionStorage } from "../src/sessions";

class FakeStorage implements SessionStorage {
  public loadedId: string | null = null;
  public touchCalls = 0;
  private sessionId: string | null = null;
  private data: Record<string, unknown> = {};

  load(id: string): void {
    if (id === "invalid") throw new UnauthorizedError("Invalid session");
    this.loadedId = id;
    this.sessionId = id;
  }

  start(): void {
    if (!this.sessionId) this.sessionId = "new-session-id";
  }

  id(): string | null {
    return this.sessionId;
  }

  get<T = unknown>(key: string, defaultValue?: T): T | undefined {
    return (this.data[key] as T) ?? defaultValue;
  }

  set(key: string, value: unknown): void {
    if (!this.sessionId) this.start();
    this.data[key] = value;
  }

  has(key: string): boolean {
    return key in this.data;
  }

  remove(key: string): void {
    delete this.data[key];
  }

  all(): Record<string, unknown> {
    return { ...this.data };
  }

  clear(): void {
    this.data = {};
  }

  save(): void {
    return;
  }

  touch(): void {
    this.touchCalls += 1;
  }

  reload(): void {
    return;
  }

  destroy(): void {
    this.sessionId = null;
    this.data = {};
  }

  regenerate(): void {
    this.destroy();
    this.start();
  }
}

const createRequest = (cookieHeader?: string): Request =>
  new Request("/test").setHeaders({ cookie: cookieHeader });

describe("sessions middleware", () => {
  it("loads existing session from cookie", async () => {
    const middleware = sessions(FakeStorage, { name: "connect.sid" });
    const request = createRequest("connect.sid=abc123");

    const response = await middleware(request, () => Response.json({ ok: true }));

    expect(request.session.id()).toBe("abc123");
    expect(response.headers["Set-Cookie"]).toBeUndefined();
  });

  it("ignores invalid cookie session and continues request", async () => {
    const middleware = sessions(FakeStorage, { name: "connect.sid" });
    const request = createRequest("connect.sid=invalid");

    const response = await middleware(request, async req => {
      await req.session.set("user", 1);
      return Response.json({ ok: true });
    });

    expect(request.session.id()).toBe("new-session-id");
    expect(response.headers["Set-Cookie"]).toContain("connect.sid=new-session-id");
  });

  it("supports legacy CookieOptions signature", async () => {
    const middleware = sessions(FakeStorage, { cookieName: "sid", maxAge: 1200 });
    const request = createRequest();

    const response = await middleware(request, async req => {
      await req.session.set("ready", true);
      return Response.text("ok");
    });

    expect(response.headers["Set-Cookie"]).toContain("sid=new-session-id");
    expect(response.headers["Set-Cookie"]).toContain("Max-Age=1200");
  });

  it("sets cookie on every response when rolling is enabled", async () => {
    const middleware = sessions(FakeStorage, {
      name: "sid",
      rolling: true,
      cookie: { maxAge: 50 },
    });
    const request = createRequest("sid=persisted");

    const response = await middleware(request, () => Response.text("ok"));

    expect(response.headers["Set-Cookie"]).toContain("sid=persisted");
    expect(response.headers["Set-Cookie"]).toContain("Max-Age=50");
  });

  it("creates session/cookie when saveUninitialized is true", async () => {
    const middleware = sessions(FakeStorage, {
      name: "sid",
      saveUninitialized: true,
    });

    const response = await middleware(createRequest(), () => Response.text("ok"));

    expect(response.headers["Set-Cookie"]).toContain("sid=new-session-id");
  });
});
