import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { RaptorEngine } from "../src/views";
import { FileNotExistsException } from "../src/exceptions";

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

    await writeFile(join(tmpDir, "home.html"), `<h1>Hola {{ user.name }}</h1>`);

    await writeFile(join(tmpDir, "plain.html"), `<p>Plain</p>`);

    engine = new RaptorEngine(tmpDir);
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("renderiza una vista usando el layout por defecto", async () => {
    const html = await engine.render("home", {
      user: { name: "Juan" },
    });

    expect(html).toBe(`<html><body><h1>Hola Juan</h1></body></html>`);
  });

  it("renderiza usando un layout explícito", async () => {
    engine.setContentAnnotation("[[CONTENT]]");

    const html = await engine.render("plain", {}, "alt");

    expect(html).toBe(`<section><p>Plain</p></section>`);
  });

  it("permite cambiar el layout por defecto", async () => {
    engine.setDefaultLayout("alt");
    engine.setContentAnnotation("[[CONTENT]]");

    const html = await engine.render("plain");

    expect(html).toBe(`<section><p>Plain</p></section>`);
  });

  it("renderiza correctamente con helpers personalizados", async () => {
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

  it("usa cache de templates (no vuelve a leer el archivo)", async () => {
    const first = await engine.render("plain");
    const second = await engine.render("plain");

    expect(first).toBe(second);
  });

  it("lanza FileNotExistsException si la vista no existe", async () => {
    await expect(engine.render("no-existe")).rejects.toBeInstanceOf(
      FileNotExistsException,
    );
  });

  it("lanza FileNotExistsException si el layout no existe", async () => {
    await expect(
      engine.render("plain", {}, "layout-fake"),
    ).rejects.toBeInstanceOf(FileNotExistsException);
  });
});
