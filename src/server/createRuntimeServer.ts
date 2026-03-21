import type { LoggerOptions } from "../http/logger";
import { BunRuntimeServer } from "./bunRuntimeServer";
import { DenoRuntimeServer } from "./denoRuntimeServer";
import { NodeRuntimeServer } from "./nodeRuntimeServer";
import { detectRuntime } from "./runtimeDetector";
import type { RuntimeKind, RuntimeServer } from "./types";

export const createRuntimeServer = (
  loggerOptions: LoggerOptions = {},
  runtime = detectRuntime(),
): RuntimeServer => {
  switch (runtime) {
    case "bun":
      return new BunRuntimeServer(loggerOptions);
    case "deno":
      return new DenoRuntimeServer(loggerOptions);
    case "node":
    default:
      return new NodeRuntimeServer(loggerOptions);
  }
};

export const createRuntimeServerByKind = (
  runtime: RuntimeKind,
  loggerOptions: LoggerOptions = {},
): RuntimeServer => {
  return createRuntimeServer(loggerOptions, runtime);
};
