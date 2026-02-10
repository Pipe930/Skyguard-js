import type { TemplateContext } from "types";

/**
 * High-level contract for view engines in the framework.
 *
 * A `View` implementation is responsible for:
 * - Resolving views and layouts
 * - Injecting data into templates
 * - Returning fully rendered HTML ready to be sent to the client
 *
 * This abstraction allows swapping view engines
 * without affecting controllers or responses.
 */
export interface View {
  /**
   * Renders a complete view.
   *
   * @param view - View name (without file extension)
   * @param params - Data context passed to the view
   * @param layout - Layout name to use
   * @returns Final rendered HTML
   *
   * @example
   * await view.render("home", { user: { name: "Felipe" } }, "main");
   */
  render(
    view: string,
    params: TemplateContext,
    layout: string,
  ): string | Promise<string>;
}

/**
 * Base contract for template engines.
 *
 * A `TemplateEngine` is a low-level component whose only responsibility
 * is transforming a template string into rendered output
 * using a given data context.
 *
 * It does NOT:
 * - Load files from disk
 * - Handle layouts
 * - Manage caching
 *
 * Those responsibilities belong to higher-level abstractions
 * such as {@link View}.
 */
export interface TemplateEngine {
  /**
   * Renders a template from an in-memory string.
   *
   * @param template - Raw template content
   * @param params - Data context for interpolation
   * @returns Rendered output
   *
   * @example
   * await engine.render("Hello {{ name }}", { name: "Felipe" });
   * // => "Hello Felipe"
   */
  render(template: string, params: TemplateContext): Promise<string>;
}
