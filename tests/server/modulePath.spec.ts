import { describe, expect, test } from "@jest/globals";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  getModulePathInfo,
  resolveFromModuleUrl,
} from "../../src/server/modulePath";

describe("modulePath", () => {
  test("builds __filename and __dirname from import.meta.url-like value", () => {
    const metaUrl = pathToFileURL(
      join(process.cwd(), "tests/server/fixtures/example.ts"),
    ).href;
    const expectedFilename = fileURLToPath(metaUrl);
    const expectedDirname = dirname(expectedFilename);
    const resolved = getModulePathInfo(metaUrl);

    expect(resolved.filename).toBe(expectedFilename);
    expect(resolved.dirname).toBe(expectedDirname);
  });

  test("resolves paths from module url", () => {
    const metaUrl = pathToFileURL(
      join(process.cwd(), "tests/server/fixtures/example.ts"),
    ).href;
    const resolved = resolveFromModuleUrl(metaUrl, "..", "public");

    expect(resolved).toBe(join(process.cwd(), "tests/server/public"));
  });
});
