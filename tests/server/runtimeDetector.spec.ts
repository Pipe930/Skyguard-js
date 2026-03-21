import {
  detectRuntime,
  isBunRuntime,
  isDenoRuntime,
} from "../../src/server/runtimeDetector";
import { createRuntimeServerByKind } from "../../src/server/createRuntimeServer";
import { NodeRuntimeServer } from "../../src/server/nodeRuntimeServer";
import { BunRuntimeServer } from "../../src/server/bunRuntimeServer";
import { DenoRuntimeServer } from "../../src/server/denoRuntimeServer";

describe("Runtime detector", () => {
  const originalBun = (globalThis as { Bun?: unknown }).Bun;
  const originalDeno = (globalThis as { Deno?: unknown }).Deno;

  afterEach(() => {
    if (typeof originalBun === "undefined") {
      delete (globalThis as { Bun?: unknown }).Bun;
    } else {
      (globalThis as { Bun?: unknown }).Bun = originalBun;
    }

    if (typeof originalDeno === "undefined") {
      delete (globalThis as { Deno?: unknown }).Deno;
    } else {
      (globalThis as { Deno?: unknown }).Deno = originalDeno;
    }
  });

  it("detects Bun first when Bun and Deno globals exist", () => {
    (globalThis as { Bun?: unknown }).Bun = {};
    (globalThis as { Deno?: unknown }).Deno = {};

    expect(isBunRuntime()).toBeTruthy();
    expect(isDenoRuntime()).toBeTruthy();
    expect(detectRuntime()).toBe("bun");
  });

  it("detects Deno when only Deno global exists", () => {
    delete (globalThis as { Bun?: unknown }).Bun;
    (globalThis as { Deno?: unknown }).Deno = {};

    expect(isBunRuntime()).toBeFalsy();
    expect(isDenoRuntime()).toBeTruthy();
    expect(detectRuntime()).toBe("deno");
  });

  it("falls back to node when Bun and Deno are missing", () => {
    delete (globalThis as { Bun?: unknown }).Bun;
    delete (globalThis as { Deno?: unknown }).Deno;

    expect(isBunRuntime()).toBeFalsy();
    expect(isDenoRuntime()).toBeFalsy();
    expect(detectRuntime()).toBe("node");
  });
});

describe("Runtime server factory", () => {
  it("returns a node runtime server", () => {
    const runtime = createRuntimeServerByKind("node");
    expect(runtime).toBeInstanceOf(NodeRuntimeServer);
  });

  it("returns a bun runtime server", () => {
    const runtime = createRuntimeServerByKind("bun");
    expect(runtime).toBeInstanceOf(BunRuntimeServer);
  });

  it("returns a deno runtime server", () => {
    const runtime = createRuntimeServerByKind("deno");
    expect(runtime).toBeInstanceOf(DenoRuntimeServer);
  });
});
