import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { RaptorEngine } from "../../src/views";
import { FileNotExistsException } from "../../src/exceptions";

describe("RaptorEngineTest", () => {
  const tmpDir = join(__dirname, "__views__");
  const layoutsDir = join(tmpDir, "layouts");
  let engine: RaptorEngine;

  beforeAll(async () => {
    await mkdir(layoutsDir, { recursive: true });

    await writeFile(
      join(layoutsDir, "main.html"),
      `<html><body>@content</body></html>`,
    );

    await writeFile(
      join(layoutsDir, "alt.html"),
      `<section>[[CONTENT]]</section>`,
    );

    await writeFile(
      join(tmpDir, "home.html"),
      `<h1>Hello {{ user.name }}</h1>`,
    );

    await writeFile(join(tmpDir, "plain.html"), `<p>Plain</p>`);

    engine = new RaptorEngine(tmpDir);
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("should render a view using the default layout", async () => {
    const html = await engine.render("home", {
      user: { name: "Juan" },
    });

    expect(html).toBe(`<html><body><h1>Hello Juan</h1></body></html>`);
  });

  it("should render using an explicit layout", async () => {
    engine.setContentAnnotation("[[CONTENT]]");

    const html = await engine.render("plain", {}, "alt");

    expect(html).toBe(`<section><p>Plain</p></section>`);
  });

  it("should allow changing the default layout", async () => {
    engine.setDefaultLayout("alt");
    engine.setContentAnnotation("[[CONTENT]]");

    const html = await engine.render("plain");

    expect(html).toBe(`<section><p>Plain</p></section>`);
  });

  it("should render correctly with custom helpers", async () => {
    engine.registerHelper("upper", (value: string) => value.toUpperCase());

    await writeFile(
      join(tmpDir, "helper.html"),
      `<p>{{ upper user.name }}</p>`,
    );

    const html = await engine.render("helper", {
      user: { name: "juan" },
    });

    expect(html).toContain("<p>JUAN</p>");
  });

  it("should use template cache and avoid re-reading the file", async () => {
    const first = await engine.render("plain");
    const second = await engine.render("plain");

    expect(first).toBe(second);
  });

  it("should throw FileNotExistsException when the view does not exist", async () => {
    await expect(engine.render("non-existing")).rejects.toBeInstanceOf(
      FileNotExistsException,
    );
  });

  it("should throw FileNotExistsException when the layout does not exist", async () => {
    await expect(
      engine.render("plain", {}, "fake-layout"),
    ).rejects.toBeInstanceOf(FileNotExistsException);
  });
});
