import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { StaticFileHandler } from "../../src/static/fileStaticHandler";

describe("StaticFileHandler integration", () => {
  it("serves files when configured with a relative directory", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "skyguard-static-"));
    const previousCwd = process.cwd();

    try {
      process.chdir(baseDir);
      await mkdir("public", { recursive: true });
      await writeFile(join("public", "a.txt"), "ok");

      const handler = new StaticFileHandler("./public");
      const response = await handler.tryServeFile("/public/a.txt");

      expect(response).not.toBeNull();
      expect(response?.statusCode).toBe(200);
    } finally {
      process.chdir(previousCwd);
      await rm(baseDir, { recursive: true, force: true });
    }
  });
});
