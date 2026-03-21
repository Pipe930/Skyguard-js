import type { RuntimeKind } from "./types";

export const isBunRuntime = (): boolean =>
  typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";
export const isDenoRuntime = (): boolean =>
  typeof (globalThis as { Deno?: unknown }).Deno !== "undefined";

export const detectRuntime = (): RuntimeKind => {
  if (isBunRuntime()) return "bun";
  if (isDenoRuntime()) return "deno";
  return "node";
};
