import {
  HelperArgumentException,
  HelperExecutionException,
  HelperNotFoundException,
} from "../exceptions/helperExceptions";
import type { HelperFunction, TemplateContext } from "../types";

/**
 * Helpers registry for the template engine.
 *
 * Stores and executes helper functions that can be invoked from templates.
 *
 * @example
 * const helpers = new HelpersManager();
 * helpers.register("bold", (text) => `<strong>${text}</strong>`);
 *
 * // Later (typically from the template engine):
 * helpers.execute("bold", '"Hello"', {}, resolveValue);
 * // => "<strong>Hello</strong>"
 */
export class HelpersManager {
  /**
   * Internal helper registry.
   *
   * Key: helper name
   * Value: executable function
   */
  private helpers = new Map<string, HelperFunction>();

  constructor() {
    this.registerDefaultHelpers();
  }

  /**
   * Registers a custom helper.
   *
   * @param name - Helper name
   * @param fn - Helper function
   *
   * @example
   * manager.register("bold", (text: string) => {
   *   return `<strong>${text}</strong>`;
   * });
   */
  public register(name: string, fn: HelperFunction): void {
    this.helpers.set(name, fn);
  }

  /**
   * Returns a helper by name.
   *
   * @param name - Helper name
   * @returns Helper function or `undefined` if not registered
   */
  public get(name: string): HelperFunction | undefined {
    return this.helpers.get(name);
  }

  /**
   * Checks whether a helper is registered.
   *
   * @param name - Helper name
   * @returns `true` if the helper exists
   */
  public has(name: string): boolean {
    return this.helpers.has(name);
  }

  /**
   * Executes a helper with parsed arguments.
   *
   * @param name - Helper name
   * @param argsString - Raw argument string (as written in the template)
   * @param context - Current render context
   * @param resolveValue - Function used to resolve context paths
   * @returns Helper output
   *
   * @throws {HelperNotFoundException} If the helper is not registered
   * @throws {HelperArgumentException} If an argument cannot be resolved
   * @throws {HelperExecutionException} If the helper throws during execution
   */
  public execute(
    name: string,
    argsString: string,
    context: TemplateContext,
    resolveValue: (path: string, ctx: TemplateContext) => unknown,
  ): string {
    const helper = this.helpers.get(name);
    if (!helper) throw new HelperNotFoundException(name);

    const args = this.parseArgs(argsString, context, resolveValue, name);

    try {
      return helper(...args);
    } catch {
      throw new HelperExecutionException(name);
    }
  }

  /**
   * Parses helper arguments from a raw string.
   *
   * Supports:
   * - quoted strings: `"text"`
   * - numbers: `123`, `3.14`
   * - booleans: `true`, `false`
   * - `null`
   * - context paths: `user.name`, `this.price`
   *
   * @param argsString - Raw argument string
   * @param context - Current render context
   * @param resolveValue - Resolves a path from the context
   * @param nameHelper - Helper name (used for error reporting)
   * @returns Parsed argument list
   *
   * @example
   * // argsString: 'this.name 100 true'
   * // => ["John", 100, true]
   */
  public parseArgs(
    argsString: string,
    context: TemplateContext,
    resolveValue: (path: string, ctx: TemplateContext) => unknown,
    nameHelper: string,
  ): unknown[] {
    const args: unknown[] = [];
    let currentArg = "";
    let inQuotes = false;

    for (let i = 0; i < argsString.length; i++) {
      const char = argsString[i];

      if (char === '"' && (i === 0 || argsString[i - 1] !== "\\")) {
        inQuotes = !inQuotes;
        currentArg += char;
      } else if (char === " " && !inQuotes && currentArg.trim()) {
        args.push(
          this.parseArgument(
            currentArg.trim(),
            context,
            resolveValue,
            nameHelper,
          ),
        );
        currentArg = "";
      } else {
        currentArg += char;
      }
    }

    if (currentArg.trim()) {
      args.push(
        this.parseArgument(
          currentArg.trim(),
          context,
          resolveValue,
          nameHelper,
        ),
      );
    }

    return args;
  }

  private parseArgument(
    arg: string,
    context: TemplateContext,
    resolveValue: (path: string, ctx: TemplateContext) => unknown,
    nameHelper: string,
  ): unknown {
    if (arg.startsWith('"') && arg.endsWith('"')) return arg.slice(1, -1);
    if (!isNaN(Number(arg)) && arg !== "") return Number(arg);
    if (arg === "true") return true;
    if (arg === "false") return false;
    if (arg === "null") return null;

    const value = resolveValue(arg, context);

    // NOTE: This treats falsy values (0, "", false) as "not found".
    // If you want to allow them, change to: if (value === undefined) ...
    if (!value) throw new HelperArgumentException(nameHelper);

    return value;
  }

  private registerDefaultHelpers(): void {
    this.helpers.set(
      "date",
      (date: string | Date, format: string = "default") => {
        const d = new Date(date);
        if (format === "short") return d.toLocaleDateString();
        return d.toLocaleString();
      },
    );

    this.helpers.set("upper", (str: string) => String(str).toUpperCase());
    this.helpers.set("lower", (str: string) => String(str).toLowerCase());

    this.helpers.set("truncate", (str: string, length: number = 50) => {
      const text = String(str);
      return text.length > length ? text.substring(0, length) + "..." : text;
    });

    this.helpers.set("currency", (amount: number) => `$${amount.toFixed(2)}`);
  }

  /**
   * Returns all registered helper names.
   *
   * @returns List of helper names
   */
  public getRegisteredHelpers(): string[] {
    return Array.from(this.helpers.keys());
  }

  /**
   * Removes a registered helper.
   *
   * @param name - Helper name to remove
   * @returns `true` if removed, `false` if it was not registered
   */
  public remove(name: string): boolean {
    return this.helpers.delete(name);
  }

  /**
   * Clears all helpers (useful for testing).
   */
  public clear(): void {
    this.helpers.clear();
  }
}
