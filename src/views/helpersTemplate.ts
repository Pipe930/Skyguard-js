import {
  HelperArgumentException,
  HelperExecutionException,
  HelperNotFoundException,
} from "@exceptions/helperExceptions";
import type { HelperFunction, TemplateContext } from "types";

/**
 * Gestor de helpers para el motor de plantillas.
 *
 * Responsabilidades:
 * - Registrar helpers (por defecto y personalizados)
 * - Ejecutar helpers con argumentos parseados
 * - Parsear argumentos de helpers desde strings
 */
export class HelpersManager {
  /**
   * Registro interno de helpers disponibles.
   * Clave: nombre del helper
   * Valor: función ejecutable
   */
  private helpers = new Map<string, HelperFunction>();

  constructor() {
    this.registerDefaultHelpers();
  }

  /**
   * Registra un helper personalizado.
   *
   * @param name Nombre del helper.
   * @param fn Función ejecutable del helper.
   *
   * @example
   * manager.registerHelper("bold", (text: string) => {
   *   return `<strong>${text}</strong>`;
   * });
   */
  public register(name: string, fn: HelperFunction): void {
    this.helpers.set(name, fn);
  }

  /**
   * Obtiene un helper por su nombre.
   *
   * @param name Nombre del helper.
   * @returns Función del helper o undefined si no existe.
   */
  public get(name: string): HelperFunction | undefined {
    return this.helpers.get(name);
  }

  /**
   * Verifica si un helper está registrado.
   *
   * @param name Nombre del helper.
   * @returns true si existe, false en caso contrario.
   */
  public has(name: string): boolean {
    return this.helpers.has(name);
  }

  /**
   * Ejecuta un helper con los argumentos proporcionados.
   *
   * @param name Nombre del helper.
   * @param argsString String crudo de argumentos.
   * @param context Contexto actual de renderizado.
   * @param resolveValue Función para resolver valores del contexto.
   *
   * @returns Resultado del helper o string vacío si falla.
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
   * Parsea los argumentos de un helper desde un string.
   *
   * Soporta:
   * - Strings entre comillas: "texto"
   * - Números: 123, 3.14
   * - Booleanos: true, false
   * - null
   * - Paths del contexto: user.name, this.price
   *
   * @param argsString String crudo de argumentos.
   * @param context Contexto actual.
   * @param resolveValue Función para resolver paths.
   *
   * @returns Array de argumentos parseados.
   *
   * @example
   * parseArgs("this.name 100 true", context, resolveValue)
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

    if (currentArg.trim())
      args.push(
        this.parseArgument(
          currentArg.trim(),
          context,
          resolveValue,
          nameHelper,
        ),
      );

    return args;
  }

  /**
   * Parsea un argumento individual.
   *
   * @param arg Argumento crudo.
   * @param context Contexto actual.
   * @param resolveValue Función para resolver valores.
   *
   * @returns Valor parseado.
   */
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

    if (!value) throw new HelperArgumentException(nameHelper);

    return value;
  }

  /**
   * Registra los helpers por defecto del motor.
   *
   * Helpers incluidos:
   * - date: Formatea fechas
   * - upper: Convierte a mayúsculas
   * - lower: Convierte a minúsculas
   * - truncate: Recorta texto
   * - currency: Formatea moneda
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
   * Obtiene todos los nombres de helpers registrados.
   *
   * @returns Array con los nombres de los helpers.
   */
  public getRegisteredHelpers(): string[] {
    return Array.from(this.helpers.keys());
  }

  /**
   * Elimina un helper registrado.
   *
   * @param name Nombre del helper a eliminar.
   * @returns true si se eliminó, false si no existía.
   */
  public remove(name: string): boolean {
    return this.helpers.delete(name);
  }

  /**
   * Limpia todos los helpers (útil para testing).
   */
  public clear(): void {
    this.helpers.clear();
  }
}
