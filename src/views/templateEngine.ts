import type { TemplateEngine } from "./view";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { HelpersManager } from "./helpersTemplate";
import type { HelperFunction, TemplateContext } from "../types";

/**
 * Motor de plantillas minimalista inspirado en Handlebars.
 * Permite renderizar vistas HTML dinámicas a partir de un contexto
 * de datos, soportando:
 *
 * - Interpolación de variables: {{ variable }}
 * - Interpolación sin escape: {{{ variable }}}
 * - Condicionales: {{#if condition}} ... {{else}} ... {{/if}}
 * - Iteraciones: {{#each items}} ... {{/each}}
 * - Partials: {{> header}}
 * - Helpers personalizados: {{ helperName arg1 arg2 }}
 *
 * Está diseñado para ser un motor simple, sin dependencias externas,
 * orientado a frameworks HTTP ligeros.
 */
export class SimpleTemplateEngine implements TemplateEngine {
  /**
   * Gestor de helpers del motor.
   */
  private helpersManager: HelpersManager;

  /**
   * Directorio base donde se encuentran las vistas y partials.
   */
  private viewsDirectory: string;

  /**
   * Crea una instancia del motor de plantillas.
   *
   * @param viewsDirectory Directorio raíz de las vistas.
   */
  constructor(viewsDirectory: string) {
    this.viewsDirectory = viewsDirectory;
    this.helpersManager = new HelpersManager();
  }

  /**
   * Renderiza una plantilla aplicando un contexto de datos.
   *
   * Pipeline de procesamiento:
   * 1. Partials
   * 2. Each (con if/helpers/interpolación internos)
   * 3. If (globales)
   * 4. Helpers (globales)
   * 5. Interpolación (global)
   *
   * @param template Contenido de la plantilla.
   * @param context Datos para la vista.
   * @returns HTML renderizado.
   */
  public async render(
    template: string,
    context: TemplateContext = {},
  ): Promise<string> {
    let result = template;

    result = await this.processPartials(result, context);
    result = this.processEach(result, context);
    result = this.processIf(result, context);
    result = this.processHelpers(result, context);
    result = this.processInterpolation(result, context);

    return result;
  }

  /**
   * Registra un helper personalizado.
   *
   * @param name Nombre del helper.
   * @param fn Función ejecutable del helper.
   */
  public registerHelper(name: string, fn: HelperFunction): void {
    this.helpersManager.register(name, fn);
  }

  /**
   * Obtiene el gestor de helpers (útil para testing o extensión).
   *
   * @returns Instancia del HelpersManager.
   */
  public get getHelpersManager(): HelpersManager {
    return this.helpersManager;
  }

  /**
   * Procesa partials.
   *
   * @param template Template o vista a procesar
   * @param context Variables locales del template
   * @returns Devuelve el template renderizado con los helpers cargados
   *
   * @example
   * Sintaxis: {{> partialName}}
   */
  private async processPartials(
    template: string,
    context: TemplateContext,
  ): Promise<string> {
    const partialRegex = /\{\{>\s*([a-zA-Z0-9/_-]+)\s*\}\}/g;
    let result = template;

    const matches = [...template.matchAll(partialRegex)];
    for (const match of matches) {
      const partialName = match[1];
      const partialPath = join(
        this.viewsDirectory,
        "partials",
        `${partialName}.html`,
      );

      try {
        const partialContent = await readFile(partialPath, "utf-8");
        const rendered = await this.render(partialContent, context);
        result = result.replace(match[0], rendered);
      } catch {
        result = result.replace(match[0], "");
      }
    }

    return result;
  }

  /**
   * Procesa bloques iterativos.
   *
   * @param template Template o vista a procesar
   * @param context Variables locales del template
   * @returns Devuelve el template renderizado con los helpers cargados
   *
   * Sintaxis: {{#each items}} ... {{/each}}
   */
  private processEach(template: string, context: TemplateContext): string {
    const eachRegex =
      /\{\{#each\s+([a-zA-Z0-9_.]+)\s*\}\}([\s\S]*?)\{\{\/each\}\}/g;

    return template.replace(
      eachRegex,
      (match: string, arrayPath: string, content: string) => {
        const array = this.resolveValue(arrayPath, context);

        if (!Array.isArray(array)) return "";

        return array
          .map((item: unknown, index: number) => {
            const itemContext: TemplateContext = {
              ...context,
              this: item,
              "@index": index,
              "@first": index === 0,
              "@last": index === array.length - 1,
            };

            let itemContent = content;

            // Pipeline dentro de each
            itemContent = this.processIf(itemContent, itemContext, true);
            itemContent = this.processHelpers(itemContent, itemContext);
            itemContent = this.processInterpolation(
              itemContent,
              itemContext,
              true,
            );

            return itemContent;
          })
          .join("");
      },
    );
  }

  /**
   * Procesa condicionales globales.
   *
   * @param template Template o vista a procesar
   * @param context Variables locales del template
   * @returns Devuelve el template con los condicionales renderizados
   */
  private processIf(
    template: string,
    context: TemplateContext,
    includeSpecialVars: boolean = false,
  ): string {
    const ifRegex = includeSpecialVars
      ? /\{\{#if\s+([a-zA-Z0-9_.@]+)\s*\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g
      : /\{\{#if\s+([a-zA-Z0-9_.]+)\s*\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;

    return template.replace(
      ifRegex,
      (condition: string, truthyContent: string, falsyContent: string = "") => {
        const value = this.resolveValue(condition, context);
        const isTruthy = this.isTruthy(value);
        return isTruthy ? truthyContent : falsyContent;
      },
    );
  }

  /**
   * Procesa helpers globales.
   *
   * @param template Template o vista a procesar
   * @param context Variables locales del template
   * @returns Devuelve el template con los helpers renderizados
   */
  private processHelpers(template: string, context: TemplateContext): string {
    const helperRegex = /\{\{\s*([a-zA-Z0-9_]+)\s+([^}]+?)\s*\}\}/g;

    return template.replace(
      helperRegex,
      (match: string, helperName: string, argsString: string) => {
        if (!this.helpersManager.has(helperName)) return match;

        return this.helpersManager.execute(
          helperName,
          argsString.trim(),
          context,
          this.resolveValue.bind(this),
        );
      },
    );
  }

  /**
   * Procesa interpolación de variables.
   *
   * @param template Template a procesar
   * @param context Contexto de datos
   * @param includeSpecialVars Si debe soportar variables especiales (@index, etc)
   */
  private processInterpolation(
    template: string,
    context: TemplateContext,
    includeSpecialVars: boolean = false,
  ): string {
    // Determinar el patrón de captura según el contexto
    const varPattern = includeSpecialVars
      ? /\{\{\{\s*([a-zA-Z0-9_.@]+)\s*\}\}\}/g // Incluye @
      : /\{\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}\}/g; // Sin @

    const escapedVarPattern = includeSpecialVars
      ? /\{\{\s*([a-zA-Z0-9_.@]+)\s*\}\}/g
      : /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

    // Sin escape: {{{ variable }}}
    template = template.replace(varPattern, (_, path: string) => {
      const value = this.resolveValue(path, context);
      return String(value ?? "");
    });

    // Con escape: {{ variable }}
    template = template.replace(escapedVarPattern, (_, path: string) => {
      const value = this.resolveValue(path, context);
      return this.escapeHtml(String(value ?? ""));
    });

    return template;
  }

  /**
   * Resuelve un path en el contexto.
   *
   * @param path Ruta del template a cargar
   * @param context Variables locales del template
   * @returns Devuelve la ruta o el path resuelto
   */
  private resolveValue(path: string, context: TemplateContext): unknown {
    const parts = path.split(".");
    let value: unknown = context;

    for (const part of parts) {
      if (value === undefined || value === null) return undefined;

      if (typeof value === "object" && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Determina si un valor es truthy.
   */
  private isTruthy(value: unknown): boolean {
    if (value === false || value === null || value === undefined) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (value === "") return false;
    return true;
  }

  /**
   * Escapa caracteres HTML para prevenir XSS.
   *
   * @param text Texto a renderizar
   * @returns Devuelve el texto parseado o renderizado
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return text.replace(/[&<>"']/g, (char) => map[char]);
  }
}
