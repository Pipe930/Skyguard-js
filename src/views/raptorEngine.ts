import type { View } from "./view";
import { SimpleTemplateEngine } from "./templateEngine";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FileNotExistsException } from "../exceptions/fileExistsException";
import type { HelperFunction, TemplateContext } from "../types";

/**
 * Framework view engine.
 *
 * `RaptorEngine` orchestrates {@link SimpleTemplateEngine} to provide:
 * - layouts (base templates)
 * - views
 * - content injection
 * - custom helpers
 *
 * Directory layout:
 *
 * /views
 *   /layouts
 *     main.html
 *   /partials
 *     header.html
 *   home.html
 *   profile.html
 *
 * Rendering features are delegated to {@link SimpleTemplateEngine}:
 * - interpolation: `{{ variable }}`
 * - conditionals: `{{#if condition}} ... {{/if}}`
 * - loops: `{{#each items}} ... {{/each}}`
 * - partials: `{{> partial }}`
 * - custom helpers
 * - automatic HTML escaping
 *
 * `RaptorEngine` focuses on composing layouts + views.
 *
 * @example
 * const view = new RaptorEngine("./views");
 * view.setDefaultLayout("main");
 *
 * const html = await view.render("home", { user: { name: "Felipe" } });
 */
export class RaptorEngine implements View {
  private viewsDirectory: string;

  /**
   * Default layout used when none is provided.
   *
   * Resolves to: `/views/layouts/{defaultLayout}.html`
   */
  private defaultLayout: string = "main";

  /**
   * Marker inside the layout where the view output is injected.
   *
   * @default "@content"
   */
  private contentAnnotation: string = "@content";

  /**
   * Internal engine that processes template syntax.
   */
  private templateEngine: SimpleTemplateEngine;

  /**
   * In-memory cache for HTML files to avoid disk reads per request.
   */
  private cacheTemplates = new Map<string, string>();

  /**
   * Creates a new view engine instance.
   *
   * @param viewsDirectory - Root directory for views
   *
   * @example
   * const view = new RaptorEngine("./views");
   */
  constructor(viewsDirectory: string) {
    this.viewsDirectory = viewsDirectory;
    this.templateEngine = new SimpleTemplateEngine(viewsDirectory);
  }

  /**
   * Renders a view using a layout.
   *
   * Flow:
   * 1) Load the layout
   * 2) Load and render the view
   * 3) Inject the view HTML into the layout using {@link RaptorEngine.contentAnnotation}
   * 4) Return the final HTML
   *
   * @param view - View name (without extension)
   * @param params - Template context data
   * @param layout - Optional layout name (defaults to {@link RaptorEngine.defaultLayout})
   * @returns Rendered HTML
   *
   * @example
   * await view.render("home", { user: { name: "Felipe" } });
   * // Reads:
   * // - /views/home.html
   * // - /views/layouts/main.html
   */
  public async render(
    view: string,
    params: TemplateContext = {},
    layout: string | null = null,
  ): Promise<string> {
    const layoutContent = await this.renderLayout(layout ?? this.defaultLayout);
    const viewContent = await this.renderView(view, params);

    return layoutContent.replace(this.contentAnnotation, viewContent);
  }

  private async renderView(
    view: string,
    params: TemplateContext = {},
  ): Promise<string> {
    const viewPath = join(this.viewsDirectory, `${view}.html`);
    return this.renderFile(viewPath, params);
  }

  private async renderLayout(layout: string): Promise<string> {
    const layoutPath = join(this.viewsDirectory, "layouts", `${layout}.html`);
    return this.renderFile(layoutPath);
  }

  /**
   * Loads and renders an HTML file (with caching).
   *
   * @param filePath - Absolute or resolved HTML file path
   * @param params - Template context data
   * @returns Rendered HTML for the file
   *
   * @throws {FileNotExistsException} If the file cannot be read
   */
  private async renderFile(
    filePath: string,
    params: TemplateContext = {},
  ): Promise<string> {
    try {
      if (this.cacheTemplates.has(filePath)) {
        const cached = this.cacheTemplates.get(filePath);
        return this.templateEngine.render(cached, params);
      }

      const fileContent = await readFile(filePath, "utf-8");
      this.cacheTemplates.set(filePath, fileContent);

      return this.templateEngine.render(fileContent, params);
    } catch {
      throw new FileNotExistsException(filePath);
    }
  }

  /**
   * Sets the default layout name.
   *
   * @param layout - Layout name (without extension)
   */
  public setDefaultLayout(layout: string): void {
    this.defaultLayout = layout;
  }

  /**
   * Sets the layout content marker used for view injection.
   *
   * @param annotation - Marker string used inside layouts
   */
  public setContentAnnotation(annotation: string): void {
    this.contentAnnotation = annotation;
  }

  /**
   * Registers a custom helper in the underlying template engine.
   *
   * @param name - Helper name
   * @param fn - Helper implementation
   *
   * @example
   * view.registerHelper("upper", (str: string) => str.toUpperCase());
   *
   * // Template usage:
   * // {{ upper user.name }}
   */
  public registerHelper(name: string, fn: HelperFunction): void {
    this.templateEngine.registerHelper(name, fn);
  }
}
