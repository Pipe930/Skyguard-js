import type { View } from "./view";
import { SimpleTemplateEngine } from "./templateEngine";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FileNotExistsException } from "../exceptions/fileExistsException";
import type { HelperFunction, TemplateContext } from "../types";

/**
 * Motor de vistas principal del framework.
 *
 * RaptorEngine es una capa de orquestación sobre `SimpleTemplateEngine`
 * que implementa el concepto de:
 *
 * - Layouts (plantillas base)
 * - Vistas (views)
 * - Inyección de contenido
 * - Helpers personalizados
 *
 * Permite estructurar las vistas siguiendo una arquitectura MVC clásica:
 *
 * /views
 *   /layouts
 *     main.html
 *   /partials
 *     header.html
 *   home.html
 *   profile.html
 *
 * Soporta:
 * - Interpolación: {{ variable }}
 * - Condicionales: {{#if condition}} ... {{/if}}
 * - Loops: {{#each items}} ... {{/each}}
 * - Partials: {{> partial }}
 * - Helpers personalizados
 * - Escape automático de HTML
 *
 * RaptorEngine NO interpreta directamente el HTML, delega
 * el procesamiento sintáctico a `SimpleTemplateEngine`.
 * Su responsabilidad es la composición de layouts + vistas.
 */
export class RaptorEngine implements View {
  private viewsDirectory: string;
  /**
   * Layout por defecto utilizado cuando no se especifica uno.
   * Corresponde a /views/layouts/{defaultLayout}.html
   */
  private defaultLayout: string = "main";

  /**
   * Marcador dentro del layout donde se inyecta
   * el contenido de la vista.
   *
   * Por defecto: "@content"
   */
  private contentAnnotation: string = "@content";
  /**
   * Motor interno encargado del procesamiento
   * de la sintaxis de plantillas.
   */
  private templateEngine: SimpleTemplateEngine;

  /**
   * Cache en memoria de archivos HTML.
   * Evita leer del disco en cada request.
   */
  private cacheTemplates = new Map<string, string>();

  /**
   * Crea una instancia del motor de vistas.
   *
   * @param viewsDirectory Directorio raíz de las vistas.
   *
   * @example
   * const view = new RaptorEngine("./views");
   */
  constructor(viewsDirectory: string) {
    this.viewsDirectory = viewsDirectory;
    this.templateEngine = new SimpleTemplateEngine(viewsDirectory);
  }

  /**
   * Renderiza una vista completa utilizando un layout.
   *
   * Flujo:
   * 1. Se carga el layout.
   * 2. Se carga la vista.
   * 3. Se inyecta la vista en el layout usando contentAnnotation.
   * 4. Se retorna el HTML final.
   *
   * @param view Nombre de la vista (sin extensión).
   * @param params Contexto de datos.
   * @param layout Layout opcional (si no se pasa, se usa el default).
   *
   * @returns Devuelve el HTML final renderizado.
   *
   * @example
   * view.render("home", { user: { name: "Felipe" } });
   *
   * Estructura:
   * /views/home.html
   * /views/layouts/main.html
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

  /**
   * Renderiza una vista individual.
   *
   * @param view Nombre de la vista (sin .html)
   * @param params Datos dinamicos que se inyectan en la vista HTML
   * @returns Devuele el archivo de la vista HTML encontrado
   *
   * @example
   * renderView("profile")
   * -> /views/profile.html
   */
  private async renderView(
    view: string,
    params: TemplateContext = {},
  ): Promise<string> {
    const viewPath = join(this.viewsDirectory, `${view}.html`);
    return this.renderFile(viewPath, params);
  }

  /**
   * Renderiza un layout.
   *
   * @param layout Nombre del layout.
   * @returns Devuele el archivo de la vista HTML encontrado
   *
   * @example
   * renderLayout("main")
   * -> /views/layouts/main.html
   */

  private async renderLayout(layout: string): Promise<string> {
    const layoutPath = join(this.viewsDirectory, "layouts", `${layout}.html`);
    return this.renderFile(layoutPath);
  }

  /**
   * Busca y valida los archivos HTML si se encuentran en las rutas designadas
   *
   * @param filePath ruta del archivo HTML
   * @param params Datos dinamicos que se inyectan en la vista HTML
   * @returns Devuelve el arvhivo HTML encontrado renderizado
   * @throws FileExistsException si el archivo no existe.
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

  public setDefaultLayout(layout: string): void {
    this.defaultLayout = layout;
  }

  public setContentAnnotation(annotation: string): void {
    this.contentAnnotation = annotation;
  }

  /**
   * Registra un helper personalizado en el motor interno.
   *
   * @param name nombre del helper
   * @param fn funcion callback del helper
   *
   * @example
   * view.registerHelper("upper", (str: string) => str.toUpperCase());
   *
   * En plantilla:
   * {{ upper user.name }}
   */
  public registerHelper(name: string, fn: HelperFunction): void {
    this.templateEngine.registerHelper(name, fn);
  }
}
