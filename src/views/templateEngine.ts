import { TemplateEngine } from "./view";
import { readFile } from "node:fs/promises";
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
  private helpers = new Map<string, HelperFunction>();
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

    this.helpers.set("currency", (amount: number) => {
      return `$${amount.toFixed(2)}`;
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
            const itemContext: TemplateContext = {
              ...context,
              this: item,
              "@index": index,
              "@first": index === 0,
              "@last": index === array.length - 1,
            };

            let itemContent = content;

            // Orden de procesamiento dentro del each:
            // 1. Condicionales (necesitan acceso a this.property)
            itemContent = this.processIfWithContext(itemContent, itemContext);

            // 2. Helpers (necesitan acceso a this.property)
            itemContent = this.processHelpersWithContext(
              itemContent,
              itemContext,
            );

            // 3. Interpolaciones (reemplazan this.property y @variables)
            itemContent = this.processInterpolationWithContext(
              itemContent,
              itemContext,
            );

            return itemContent;
          })
          .join("");
      },
    );
  }

  /**
   * Procesa bloques condicionales usando un contexto específico.
   *
   * Esta variante es utilizada dentro de bloques `#each`, donde el contexto
   * incluye variables especiales como `this`, `@index`, `@first` y `@last`.
   *
   * @param template Fragmento de plantilla a procesar.
   * @param context Contexto específico del elemento iterado.
   *
   * @returns Fragmento de plantilla con el bloque `#if` resuelto.
   *
   * Sintaxis soportada:
   * {{#if condition}}
   *   contenido verdadero
   * {{else}}
   *   contenido falso
   * {{/if}}
   */
  private processIfWithContext(
    template: string,
    context: TemplateContext,
  ): string {
    const ifRegex =
      /\{\{#if\s+([a-zA-Z0-9_.@]+)\s*\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;

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
   * Procesa helpers usando un contexto específico.
   *
   * Esta versión se ejecuta dentro de bloques `#each` para permitir
   * que los helpers accedan a:
   *
   * - `this`
   * - `this.prop`
   * - `@index`, `@first`, `@last`
   *
   * @param template Fragmento de plantilla.
   * @param context Contexto específico del bloque iterado.
   *
   * @returns Fragmento de plantilla con los helpers evaluados.
   */
  private processHelpersWithContext(
    template: string,
    context: TemplateContext,
  ): string {
    const helperRegex = /\{\{\s*([a-zA-Z0-9_]+)\s+([^}]+?)\s*\}\}/g;

    return template.replace(
      helperRegex,
      (match: string, helperName: string, argsString: string) => {
        const helper = this.helpers.get(helperName);
        if (!helper) return match;

        const args = this.parseHelperArgs(argsString.trim(), context);

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
   * Procesa interpolaciones usando un contexto personalizado.
   *
   * Esta variante se usa dentro de `#each` para resolver correctamente:
   * - `this`
   * - `this.prop`
   * - Variables especiales (`@index`, etc.)
   *
   * Soporta:
   * - Interpolación con escape: {{ variable }}
   * - Interpolación sin escape: {{{ variable }}}
   *
   * @param template Fragmento de plantilla.
   * @param context Contexto específico del bloque.
   *
   * @returns Fragmento de plantilla interpolado.
   */
  private processInterpolationWithContext(
    template: string,
    context: TemplateContext,
  ): string {
    // Sin escape: {{{ variable }}}
    template = template.replace(
      /\{\{\{\s*([a-zA-Z0-9_.@]+)\s*\}\}\}/g,
      (match: string, path: string) => {
        const value = this.resolveValue(path, context);
        return String(value ?? "");
      },
    );

    // Con escape: {{ variable }}
    template = template.replace(
      /\{\{\s*([a-zA-Z0-9_.@]+)\s*\}\}/g,
      (match: string, path: string) => {
        const value = this.resolveValue(path, context);
        return this.escapeHtml(String(value ?? ""));
      },
    );

    return template;
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
    const helperRegex = /\{\{\s*([a-zA-Z0-9_]+)\s+([^}]+?)\s*\}\}/g;

    return template.replace(
      helperRegex,
      (match: string, helperName: string, argsString: string) => {
        const helper = this.helpers.get(helperName);

        if (!helper) return match;

        const args = this.parseHelperArgs(argsString.trim(), context);

        try {
          return helper(...args);
        } catch (error) {
          console.error(`Error executing helper ${helperName}:`, error);
          console.error(`Helper: ${helperName}, Args:`, args);
          return "";
        }
      },
    );
  }

  /**
   * Parsea los argumentos de un helper.
   *
   * Soporta:
   * - Strings entre comillas
   * - Números
   * - Booleanos
   * - null
   * - Paths del contexto (ej: user.name)
   *
   * Ejemplo:
   * {{ truncate post.content 100 }}
   *
   * @param argsString Cadena de argumentos crudos del helper.
   * @param context Contexto actual de renderizado.
   *
   * @returns Lista de argumentos ya parseados y tipados.
   */
  private parseHelperArgs(
    argsString: string,
    context: TemplateContext,
  ): unknown[] {
    const args: unknown[] = [];
    let currentArg = "";
    let inQuotes = false;

    for (let i = 0; i < argsString.length; i++) {
      const char = argsString[i];

      if (char === '"' && (i === 0 || argsString[i - 1] !== "\\")) {
        inQuotes = !inQuotes;
        currentArg += char;
      } else if (char === " " && !inQuotes) {
        if (currentArg.trim()) {
          args.push(this.parseArgument(currentArg.trim(), context));
          currentArg = "";
        }
      } else {
        currentArg += char;
      }
    }

    if (currentArg.trim())
      args.push(this.parseArgument(currentArg.trim(), context));

    return args;
  }

  /**
   * Parsea un argumento individual de un helper.
   *
   * Reglas de parsing:
   * - "texto" → string
   * - 123 → number
   * - true / false → boolean
   * - null → null
   * - path → resolución desde el contexto
   *
   * @param arg Argumento crudo.
   * @param context Contexto actual.
   *
   * @returns Valor parseado.
   */
  private parseArgument(arg: string, context: TemplateContext): unknown {
    if (arg.startsWith('"') && arg.endsWith('"')) return arg.slice(1, -1);
    if (!isNaN(Number(arg)) && arg !== "") return Number(arg);

    if (arg === "true") return true;
    if (arg === "false") return false;

    if (arg === "null") return null;

    const value = this.resolveValue(arg, context);

    if (value === undefined)
      console.warn(`Helper argument "${arg}" resolved to undefined`);

    return value;
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
   * Resuelve un path dot-notation dentro del contexto.
   *
   * Convierte:
   * "user.profile.name"
   * en:
   * context.user.profile.name
   *
   * @param path Ruta a resolver.
   * @param context Contexto base.
   *
   * @returns Valor encontrado o `undefined` si no existe.
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
   * Escapa caracteres HTML peligrosos para prevenir XSS.
   *
   * Caracteres escapados:
   * - &
   * - <
   * - >
   * - "
   * - '
   *
   * @param text Texto original.
   *
   * @returns Texto seguro para renderizar en HTML.
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
