import type { TemplateEngine } from "./view";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { HelpersManager } from "./helpersTemplate";
import type { HelperFunction, TemplateContext } from "../types";

/**
 * Minimal template engine inspired by Handlebars.
 *
 * Renders HTML templates from a data context and supports:
 * - Variable interpolation: `{{ variable }}`
 * - Unescaped interpolation: `{{{ variable }}}`
 * - Conditionals: `{{#if condition}} ... {{else}} ... {{/if}}`
 * - Iteration: `{{#each items}} ... {{/each}}`
 * - Partials: `{{> header}}`
 * - Custom helpers: `{{ helperName arg1 arg2 }}`
 *
 * Designed as a lightweight, dependency-free engine for small HTTP frameworks.
 *
 * @example
 * const engine = new SimpleTemplateEngine("./views");
 *
 * engine.registerHelper("upper", (value) => String(value).toUpperCase());
 *
 * const html = await engine.render(
 *   "<h1>{{ upper title }}</h1>{{#if user}}<p>{{ user.name }}</p>{{/if}}",
 *   { title: "hello", user: { name: "Felipe" } }
 * );
 */
export class SimpleTemplateEngine implements TemplateEngine {
  /** Helper registry for this engine. */
  private helpersManager: HelpersManager;

  /** Base directory where views and partials are stored. */
  private viewsDirectory: string;

  /**
   * Creates a new template engine instance.
   *
   * @param viewsDirectory - Root directory for views
   */
  constructor(viewsDirectory: string) {
    this.viewsDirectory = viewsDirectory;
    this.helpersManager = new HelpersManager();
  }

  /**
   * Renders a template using the given context.
   *
   * Processing pipeline:
   * 1) Partials
   * 2) Each blocks (with nested if/helpers/interpolation)
   * 3) If blocks (global)
   * 4) Helpers (global)
   * 5) Interpolation (global)
   *
   * @param template - Raw template content
   * @param context - Template context data
   * @returns Rendered HTML
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
   * Registers a custom helper.
   *
   * @param name - Helper name
   * @param fn - Helper function
   */
  public registerHelper(name: string, fn: HelperFunction): void {
    this.helpersManager.register(name, fn);
  }

  /**
   * Exposes the helper manager (useful for testing or extension).
   *
   * @returns {@link HelpersManager} instance
   */
  public get getHelpersManager(): HelpersManager {
    return this.helpersManager;
  }

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

            // Pipeline inside each
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
        return this.isTruthy(value) ? truthyContent : falsyContent;
      },
    );
  }

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

  private processInterpolation(
    template: string,
    context: TemplateContext,
    includeSpecialVars: boolean = false,
  ): string {
    const varPattern = includeSpecialVars
      ? /\{\{\{\s*([a-zA-Z0-9_.@]+)\s*\}\}\}/g
      : /\{\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}\}/g;

    const escapedVarPattern = includeSpecialVars
      ? /\{\{\s*([a-zA-Z0-9_.@]+)\s*\}\}/g
      : /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

    // Unescaped: {{{ variable }}}
    template = template.replace(varPattern, (_, path: string) => {
      const value = this.resolveValue(path, context);
      return String(value ?? "");
    });

    // Escaped: {{ variable }}
    template = template.replace(escapedVarPattern, (_, path: string) => {
      const value = this.resolveValue(path, context);
      return this.escapeHtml(String(value ?? ""));
    });

    return template;
  }

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

  private isTruthy(value: unknown): boolean {
    if (value === false || value === null || value === undefined) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (value === "") return false;
    return true;
  }

  /**
   * Escapes HTML characters to mitigate XSS in `{{ ... }}` interpolation.
   *
   * @param text - Raw text to escape
   * @returns Escaped text
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
