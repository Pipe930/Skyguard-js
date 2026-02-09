import { SimpleTemplateEngine } from "../../src/views/templateEngine";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

jest.mock("node:fs/promises");

describe("SimpleTemplateEngineTest", () => {
  let engine: SimpleTemplateEngine;

  beforeEach(() => {
    engine = new SimpleTemplateEngine(join(".", "views"));
  });

  it("should interpolate variables", async () => {
    const template = "<h1>Hello {{ user.name }}</h1>";
    const html = await engine.render(template, {
      user: { name: "juan" },
    });

    expect(html).toBe("<h1>Hello juan</h1>");
  });

  it("should escape html by default", async () => {
    const template = "<p>{{ content }}</p>";
    const html = await engine.render(template, {
      content: "<script>alert(1)</script>",
    });

    expect(html).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  });

  it("should render truthy if block", async () => {
    const template = "{{#if user.isAdmin}}ADMIN{{else}}USER{{/if}}";
    const html = await engine.render(template, { user: { isAdmin: true } });

    expect(html).toBe("ADMIN");
  });

  it("should iterate over array with #each", async () => {
    const template = `
    <ul>
      {{#each users}}
        <li>{{ this.name }} - {{ @index }}</li>
      {{/each}}
    </ul>
    `;

    const html = await engine.render(template, {
      users: [{ name: "Ana" }, { name: "Juan" }],
    });

    expect(html.replace(/\s+/g, "")).toBe(
      "<ul><li>Ana-0</li><li>Juan-1</li></ul>",
    );
  });

  it("should use default helper upper", async () => {
    const template = "{{ upper user.name }}";
    const html = await engine.render(template, {
      user: { name: "juan" },
    });

    expect(html).toBe("JUAN");
  });

  it("should register and use custom helper", async () => {
    engine.registerHelper("double", (n: number) => String(n * 2));

    const template = "{{ double price }}";
    const html = await engine.render(template, { price: 10 });

    expect(html).toBe("20");
  });

  it("should render partials", async () => {
    const template = "<header>My App</header>";

    (readFile as jest.Mock).mockResolvedValueOnce(template);
    const html = await engine.render("{{> header}}", {});

    expect(html).toBe(template);
  });

  it("should ignore missing partials", async () => {
    (readFile as jest.Mock).mockRejectedValueOnce(new Error());

    const html = await engine.render("{{> notfound }}", {});

    expect(html).toBe("");
  });
});
