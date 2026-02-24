import { join } from "path";

export type TemplateEngineFunction = (
  templatePath: string,
  data: Record<string, any>,
) => Promise<string>;

export class ViewEngine {
  private viewsPath: string = "";
  private templateEngine: TemplateEngineFunction | null = null;
  private defaultExtension: string = "html";

  /**
   * Configura la ruta donde se encuentran las vistas
   */
  public setViewsPath(viewsPath: string): void {
    this.viewsPath = viewsPath;
  }

  /**
   * Configura el motor de plantillas
   */
  public setEngine(extension: string, engine: TemplateEngineFunction): void {
    this.defaultExtension = extension;
    this.templateEngine = engine;
  }

  /**
   * Renderiza una plantilla con datos
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
   * Verifica si hay un motor de plantillas configurado
   */
  public hasEngine(): boolean {
    return this.templateEngine !== null && this.viewsPath !== "";
  }
}
