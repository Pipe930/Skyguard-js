import { TemplateEngine } from "./view";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HelperFunction, TemplateContext } from "../utils/types";

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
   * Registro interno de helpers disponibles en las plantillas.
   * La clave es el nombre del helper y el valor es la función ejecutable.
   */
  private helpers: Map<string, HelperFunction> = new Map();
  /**
   * Directorio base donde se encuentran las vistas y partials.
   * Ejemplo: /views
   * Los partials se buscan en: /views/partials
   */
  private viewsDirectory: string;

  /**
   * Crea una instancia del motor de plantillas.
   *
   * @param viewsDirectory Directorio raíz de las vistas.
   */
  constructor(viewsDirectory: string) {
    this.viewsDirectory = viewsDirectory;
    this.registerDefaultHelpers();
  }

  /**
   * Renderiza una plantilla aplicando un contexto de datos.
   *
   * Este método es el punto de entrada principal del motor.
   * Ejecuta el pipeline completo de procesamiento:
   *
   * 1. Partials
   * 2. Each
   * 3. If
   * 4. Helpers
   * 5. Interpolación
   *
   * @param template Contenido de la plantilla (string HTML).
   * @param context Objeto con los datos disponibles en la vista.
   *
   * @returns Devuelve el HTML final completamente renderizado.
   *
   * @example
   * const engine = new SimpleTemplateEngine("./views");
   *
   * const html = engine.render(
   *   "<h1>Hello {{ user.name }}</h1>",
   *   { user: { name: "Felipe" } }
   * );
   *
   * // Resultado:
   * // <h1>Hello Felipe</h1>
   */
  public render(template: string, context: TemplateContext = {}): string {
    let result = template;

    result = this.processPartials(result, context);
    result = this.processEach(result, context);
    result = this.processIf(result, context);
    result = this.processHelpers(result, context);
    result = this.processInterpolation(result, context);

    return result;
  }

  /**
   * Registra un helper personalizado.
   *
   * Los helpers permiten extender el lenguaje de plantillas
   * con funciones reutilizables.
   *
   * @param name Nombre del helper.
   * @param fn Función ejecutable del helper.
   *
   * @example
   * engine.registerHelper("currency", (value: number) => {
   *   return `$${value.toFixed(2)}`;
   * });
   *
   * // En la plantilla:
   * // {{ currency price }}
   */
  public registerHelper(name: string, fn: HelperFunction): void {
    this.helpers.set(name, fn);
  }

  /**
   * Registra helpers por defecto del motor.
   *
   * Helpers incluidos:
   * - date: formatea fechas
   * - upper: convierte a mayúsculas
   * - lower: convierte a minúsculas
   * - truncate: recorta texto
   */
  private registerDefaultHelpers(): void {
    this.helpers.set(
      "date",
      (date: string | Date, format: string = "default") => {
        const d = new Date(date);
        if (format === "short") return d.toLocaleDateString();
        return d.toLocaleString();
      },
    );

    this.helpers.set("upper", (str: string) => {
      return String(str).toUpperCase();
    });

    this.helpers.set("lower", (str: string) => {
      return String(str).toLowerCase();
    });

    this.helpers.set("truncate", (str: string, length: number = 50) => {
      const text = String(str);
      return text.length > length ? text.substring(0, length) + "..." : text;
    });
  }

  /**
   * Procesa partials.
   *
   * @param template Nombre del template o vista
   * @param context Datos que seran inyectados al HTML
   * @returns Devuelve la vista o el HTML renderisado
   *
   * Sintaxis:
   * {{> partialName}}
   *
   * Busca el archivo:
   * {viewsDirectory}/partials/partialName.html
   *
   * @example
   * // views/partials/header.html
   * <header>My App</header>
   *
   * // En plantilla:
   * {{> header}}
   */
  private processPartials(template: string, context: TemplateContext): string {
    const partialRegex = /\{\{>\s*([a-zA-Z0-9/_-]+)\s*\}\}/g;

    return template.replace(
      partialRegex,
      (match: string, partialName: string) => {
        const partialPath = join(
          this.viewsDirectory,
          "partials",
          `${partialName}.html`,
        );

        if (!existsSync(partialPath)) {
          console.warn(`Partial not found: ${partialPath}`);
          return "";
        }

        const partialContent = readFileSync(partialPath, "utf-8");
        return this.render(partialContent, context);
      },
    );
  }

  /**
   * Procesa bloques iterativos.
   *
   * @param template Nombre del template o vista
   * @param context Datos que seran inyectados al HTML
   * @returns Devuelve la vista o el HTML renderisado
   *
   * Sintaxis:
   * {{#each items}}
   *   {{ this.name }} - {{ @index }}
   * {{/each}}
   *
   * Variables disponibles:
   * - this: elemento actual
   * - this.prop: propiedad del elemento
   * - @index: índice
   * - @first: boolean
   * - @last: boolean
   *
   * @example
   * const template = `
   * <ul>
   *   {{#each users}}
   *     <li>{{ this.name }}</li>
   *   {{/each}}
   * </ul>
   * `;
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
            let itemContent = content.replace(
              /\{\{\s*this\.([a-zA-Z0-9_]+)\s*\}\}/g,
              (m: string, prop: string) => {
                const value = this.getPropertyValue(item, prop);
                return this.escapeHtml(String(value ?? ""));
              },
            );

            itemContent = itemContent.replace(
              /\{\{\s*this\s*\}\}/g,
              this.escapeHtml(String(item)),
            );

            itemContent = itemContent.replace(
              /\{\{\s*@index\s*\}\}/g,
              String(index),
            );
            itemContent = itemContent.replace(
              /\{\{\s*@first\s*\}\}/g,
              String(index === 0),
            );
            itemContent = itemContent.replace(
              /\{\{\s*@last\s*\}\}/g,
              String(index === array.length - 1),
            );

            return itemContent;
          })
          .join("");
      },
    );
  }

  /**
   * Procesa bloques condicionales.
   *
   * @param template Nombre del template o vista
   * @param context Datos que seran inyectados al HTML
   * @returns Devuelve la vista o el HTML renderisado
   *
   * Sintaxis:
   * {{#if condition}}
   *   contenido verdadero
   * {{else}}
   *   contenido falso
   * {{/if}}
   *
   * @example
   * {{#if user.isAdmin}}
   *   <button>Admin Panel</button>
   * {{else}}
   *   <p>User</p>
   * {{/if}}
   */
  private processIf(template: string, context: TemplateContext): string {
    const ifRegex =
      /\{\{#if\s+([a-zA-Z0-9_.]+)\s*\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;

    return template.replace(
      ifRegex,
      (
        match: string,
        condition: string,
        truthyContent: string,
        falsyContent: string = "",
      ) => {
        const value = this.resolveValue(condition, context);
        const isTruthy = this.isTruthy(value);

        return isTruthy ? truthyContent : falsyContent;
      },
    );
  }

  /**
   * Procesa helpers definidos.
   *
   * @param template Nombre del template o vista
   * @param context Datos que seran inyectados al HTML
   * @returns Devuelve la vista o el HTML renderisado
   *
   * Sintaxis:
   * {{ helperName arg1 arg2 }}
   *
   * @example
   * {{ upper user.name }}
   * {{ truncate post.content 100 }}
   */
  private processHelpers(template: string, context: TemplateContext): string {
    const helperRegex = /\{\{([a-zA-Z0-9_]+)\s+([^}]+)\}\}/g;

    return template.replace(
      helperRegex,
      (match: string, helperName: string, argsString: string) => {
        const helper = this.helpers.get(helperName);

        if (!helper) return match;

        const args = argsString.split(/\s+/).map((arg: string): unknown => {
          if (arg.startsWith('"') && arg.endsWith('"')) return arg.slice(1, -1);
          if (!isNaN(Number(arg))) return Number(arg);

          return this.resolveValue(arg, context);
        });

        try {
          return helper(...args);
        } catch (error) {
          console.error(`Error executing helper ${helperName}:`, error);
          return "";
        }
      },
    );
  }

  /**
   * Procesa interpolación de variables.
   *
   * @param template Nombre del template o vista
   * @param context Datos que seran inyectados al HTML
   * @returns Devuelve la vista o el HTML renderisado
   *
   * - Con escape HTML: {{ variable }}
   * - Sin escape: {{{ variable }}}
   *
   * @example
   * <p>{{ user.bio }}</p>
   */
  private processInterpolation(
    template: string,
    context: TemplateContext,
  ): string {
    // Interpolación sin escape: {{{ variable }}}
    template = template.replace(
      /\{\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}\}/g,
      (match: string, path: string) => {
        const value = this.resolveValue(path, context);
        return String(value ?? "");
      },
    );

    // Interpolación con escape: {{ variable }}
    template = template.replace(
      /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g,
      (match: string, path: string) => {
        const value = this.resolveValue(path, context);
        return this.escapeHtml(String(value ?? ""));
      },
    );

    return template;
  }

  /**
   * Obtiene el valor de una propiedad de un objeto desconocido.
   */
  private getPropertyValue(obj: unknown, prop: string): unknown {
    if (obj === null || obj === undefined) return undefined;

    if (typeof obj === "object" && prop in obj)
      return (obj as Record<string, unknown>)[prop];

    return undefined;
  }

  /**
   * Resuelve un path en el contexto.
   *
   * @param template Nombre del template o vista
   * @param context Datos que seran inyectados al HTML
   * @returns Devuelve la vista o el HTML renderisado
   *
   * Convierte:
   * "user.profile.name"
   * en:
   * context.user.profile.name
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
   * Determina si un valor es considerado "truthy".
   * Se usa en bloques #if.
   *
   * @param value valor de los #if
   * @returns Devuelve un buleano validando el dato
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
   * @param text Texto del HTML a parsear
   * @returns Devuelve los valores parseados
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
