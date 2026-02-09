import type { RuleOptions } from "../types";
import type { ValidationRule } from "./validationRule";
import {
  BooleanRule,
  DateRule,
  DateRuleOptions,
  EmailRule,
  NumberRule,
  NumberRuleOptions,
  RequiredRule,
  StringRule,
  StringRuleOptions,
} from "../rules";
import { ValidatorFieldException } from "@exceptions/validationException";

/**
 * Definición de un campo en el schema.
 */
export interface FieldDefinition {
  rules: Array<{ rule: ValidationRule; options?: RuleOptions }>;
  optional: boolean;
}

/**
 * Schema para definir esquemas de validación declarativos y encadenables.
 *
 * ❗ Esta clase NO ejecuta la validación.
 * Su responsabilidad es **construir una definición de schema**
 * que luego será interpretada por un validador.
 *
 * ## Patrón de diseño
 * - Builder Pattern
 * - API fluida (Fluent Interface)
 *
 * ## Flujo de uso
 * 1. Se crea una instancia mediante `create()`
 * 2. Se selecciona un campo con `field(name)`
 * 3. Se agregan reglas encadenadas al campo actual
 * 4. Se finaliza con `build()`
 *
 * ## Ejemplo
 * ```ts
 * const schema = ValidationSchema.create()
 *   .field("email")
 *     .required("El email es obligatorio")
 *     .string()
 *     .email()
 *   .field("age")
 *     .number({ min: 18, max: 100 })
 *   .field("bio")
 *     .optional()
 *     .string({ max: 500 })
 *   .build();
 * ```
 */
export class ValidationSchema {
  /**
   * Definición interna de los campos del schema.
   * Cada campo contiene sus reglas y metadatos.
   */
  private fields = new Map<string, FieldDefinition>();

  /**
   * Nombre del campo actualmente seleccionado.
   * Todas las reglas se aplican a este campo
   * hasta que se llame nuevamente a `field()`.
   */
  private currentField: string | null = null;

  /**
   * Constructor privado.
   * Obliga a crear instancias mediante `create()`
   * para mantener una API controlada.
   */
  private constructor() {}

  /**
   * Crea una nueva instancia de ValidationSchema.
   *
   * @returns ValidationSchema
   */
  public static create(): ValidationSchema {
    return new ValidationSchema();
  }

  /**
   * Selecciona (o crea) un campo dentro del schema.
   *
   * Todas las reglas encadenadas posteriormente
   * se aplicarán a este campo.
   *
   * @param name Nombre del campo
   */
  public field(name: string): this {
    this.currentField = name;

    if (!this.fields.has(name)) {
      this.fields.set(name, {
        rules: [],
        optional: false,
      });
    }

    return this;
  }

  /**
   * Marca el campo actual como obligatorio.
   *
   * - El campo debe existir en los datos
   * - El valor no puede ser null ni undefined
   *
   * @param message Mensaje de error personalizado
   */
  public required(message?: string): this {
    this.setOptional(false);
    this.addRule(new RequiredRule(), { message });
    return this;
  }

  /**
   * Valida que el valor del campo sea un string.
   *
   * @param options Opciones de validación para strings
   */
  public string(options?: StringRuleOptions): this {
    this.addRule(new StringRule(), options);
    return this;
  }

  /**
   * Valida que el valor del campo sea un número.
   *
   * @param options Opciones de validación numérica
   */
  public number(options?: NumberRuleOptions): this {
    this.addRule(new NumberRule(), options);
    return this;
  }

  /**
   * Valida que el valor del campo sea un booleano.
   *
   * @param message Mensaje de error personalizado
   */
  public boolean(message?: string): this {
    this.addRule(new BooleanRule(), { message });
    return this;
  }

  /**
   * Valida que el valor del campo tenga formato de email.
   *
   * @param message Mensaje de error personalizado
   */
  public email(message?: string): this {
    this.addRule(new EmailRule(), { message });
    return this;
  }

  /**
   * Valida que el valor del campo sea una fecha válida.
   *
   * @param options Opciones de validación de fechas
   */
  public date(options?: DateRuleOptions): this {
    this.addRule(new DateRule(), options);
    return this;
  }

  /**
   * Marca el campo actual como opcional.
   *
   * ## Comportamiento
   * - Si el campo NO existe en los datos → se ignora completamente
   * - Si el campo existe → se validan todas sus reglas
   *
   * Esto permite definir campos opcionales con restricciones.
   *
   * @example
   * schema.field("bio")
   *   .optional()
   *   .string({ max: 500 });
   */
  public optional(): this {
    this.setOptional(true);
    return this;
  }

  /**
   * Agrega una regla de validación personalizada
   * al campo actual.
   *
   * Útil para lógica de negocio específica
   * que no pertenece a las reglas estándar.
   *
   * @param rule Regla personalizada
   * @param options Opciones de la regla
   */
  public custom(rule: ValidationRule, options?: RuleOptions): this {
    this.addRule(rule, options);
    return this;
  }

  /**
   * Finaliza la construcción del schema.
   *
   * @returns Definición interna del schema
   * que será consumida por el motor de validación.
   */
  public build(): Map<string, FieldDefinition> {
    return this.fields;
  }

  /**
   * Define si el campo actual es opcional u obligatorio.
   *
   * @throws Error si no hay un campo seleccionado
   */
  private setOptional(optional: boolean): void {
    if (!this.currentField) throw new ValidatorFieldException();

    const field = this.fields.get(this.currentField);
    if (field) field.optional = optional;
  }

  /**
   * Agrega una regla al campo actualmente seleccionado.
   *
   * @throws Error si no hay un campo seleccionado
   */
  private addRule(rule: ValidationRule, options?: RuleOptions): void {
    if (!this.currentField) throw new ValidatorFieldException();

    const field = this.fields.get(this.currentField);
    if (field) field.rules.push({ rule, options });
  }
}
