import { join } from "path";

/**
 * Defines the contract for a template engine function.
 *
 * A template engine must receive the absolute path to the template file
 * and a data object containing the variables to inject into the template.
 * It must return a Promise that resolves with the rendered HTML string.
 *
 * @param templatePath - Absolute path to the template file.
 * @param data - Key-value object containing template variables.
 * @returns A Promise resolving to the rendered HTML output.
 */
export type TemplateEngineFunction = (
  templatePath: string,
  data: Record<string, any>,
) => Promise<string>;

/**
 * Responsible for managing template rendering within the framework.
 * It acts as a thin abstraction layer between the application and
 * the configured template engine.
 *
 * This class does not implement any rendering logic itself;
 * it delegates rendering to the configured TemplateEngineFunction.
 */
export class ViewEngine {
  private viewsPath: string = "";
  private templateEngine: TemplateEngineFunction | null = null;
  private defaultExtension: string = "html";

  /**
   * Sets the base directory where view templates are located.
   *
   * @param viewsPath - Absolute or relative path to the views directory.
   */
  public setViewsPath(viewsPath: string): void {
    this.viewsPath = viewsPath;
  }

  /**
   * Registers a template engine and defines its default file extension.
   *
   * The extension will be automatically appended when resolving view names.
   *
   * @param extension - File extension associated with the engine (e.g. "ejs", "pug", "html").
   * @param engine - Template engine implementation that conforms to TemplateEngineFunction.
   */
  public setEngine(extension: string, engine: TemplateEngineFunction): void {
    this.defaultExtension = extension;
    this.templateEngine = engine;
  }

  /**
   * Renders a template using the configured engine.
   *
   * @param viewName - Name of the template file (without extension).
   * @param data - Optional object containing variables to inject into the template.
   * @returns A Promise resolving to the rendered HTML string.
   * @throws Error if rendering fails or if the engine is not properly configured.
   */
  public async render(
    viewName: string,
    data: Record<string, any> = {},
  ): Promise<string> {
    try {
      const templatePath = join(
        this.viewsPath,
        `${viewName}.${this.defaultExtension}`,
      );

      return await this.templateEngine(templatePath, data);
    } catch (error) {
      throw new Error(
        `Error rendering template "${viewName}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Indicates whether a template engine and views directory
   * have been properly configured.
   *
   * @returns True if the engine is ready to render templates, otherwise false.
   */
  public hasEngine(): boolean {
    return this.templateEngine !== null && this.viewsPath !== "";
  }
}
