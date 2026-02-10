import type { RuleOptions } from "./types";
import type { ValidationRule } from "./validationRule";
import {
  BooleanRule,
  DateRule,
  type DateRuleOptions,
  EmailRule,
  NumberRule,
  type NumberRuleOptions,
  RequiredRule,
  StringRule,
  type StringRuleOptions,
} from "./rules";
import { ValidatorFieldException } from "../exceptions/validationException";

/**
 * Field definition used by the validation engine.
 */
export interface FieldDefinition {
  rules: Array<{ rule: ValidationRule; options?: RuleOptions }>;
  optional: boolean;
}

/**
 * Declarative and chainable validation schema builder.
 *
 * This class does not execute validation.
 * Its responsibility is to build a schema definition that will later
 * be interpreted by the validation engine.
 *
 * Design:
 * - Builder Pattern
 * - Fluent Interface
 *
 * Usage flow:
 * 1) Create an instance via {@link ValidationSchema.create}
 * 2) Select a field with {@link ValidationSchema.field}
 * 3) Chain validation rules for the selected field
 * 4) Finish with {@link ValidationSchema.build}
 *
 * @example
 * const schema = ValidationSchema.create()
 *   .field("email")
 *     .required("Email is required")
 *     .string()
 *     .email()
 *   .field("age")
 *     .number({ min: 18, max: 100 })
 *   .field("bio")
 *     .optional()
 *     .string({ max: 500 })
 *   .build();
 */
export class ValidationSchema {
  /**
   * Internal schema field definitions.
   */
  private fields = new Map<string, FieldDefinition>();

  /**
   * Currently selected field name.
   *
   * All chained rules apply to this field until {@link ValidationSchema.field}
   * is called again.
   */
  private currentField: string | null = null;

  /**
   * Private constructor.
   *
   * Forces creation through {@link ValidationSchema.create}
   * to keep a controlled API.
   */
  private constructor() {}

  /**
   * Creates a new {@link ValidationSchema} instance.
   *
   * @returns A new {@link ValidationSchema}
   */
  public static create(): ValidationSchema {
    return new ValidationSchema();
  }

  /**
   * Selects (or creates) a field within the schema.
   *
   * All subsequently chained rules will be applied to this field.
   *
   * @param name - Field name
   * @returns The schema instance (for chaining)
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
   * Marks the current field as required.
   *
   * - The field must exist in the input
   * - The value must not be `null` or `undefined`
   *
   * @param message - Optional custom error message
   * @returns The schema instance (for chaining)
   */
  public required(message?: string): this {
    this.setOptional(false);
    this.addRule(new RequiredRule(), { message });
    return this;
  }

  /**
   * Validates that the current field value is a string.
   *
   * @param options - String validation options
   * @returns The schema instance (for chaining)
   */
  public string(options?: StringRuleOptions): this {
    this.addRule(new StringRule(), options);
    return this;
  }

  /**
   * Validates that the current field value is a number.
   *
   * @param options - Numeric validation options
   * @returns The schema instance (for chaining)
   */
  public number(options?: NumberRuleOptions): this {
    this.addRule(new NumberRule(), options);
    return this;
  }

  /**
   * Validates that the current field value is a boolean.
   *
   * @param message - Optional custom error message
   * @returns The schema instance (for chaining)
   */
  public boolean(message?: string): this {
    this.addRule(new BooleanRule(), { message });
    return this;
  }

  /**
   * Validates that the current field value is a valid email.
   *
   * @param message - Optional custom error message
   * @returns The schema instance (for chaining)
   */
  public email(message?: string): this {
    this.addRule(new EmailRule(), { message });
    return this;
  }

  /**
   * Validates that the current field value is a valid date.
   *
   * @param options - Date validation options
   * @returns The schema instance (for chaining)
   */
  public date(options?: DateRuleOptions): this {
    this.addRule(new DateRule(), options);
    return this;
  }

  /**
   * Marks the current field as optional.
   *
   * This allows defining optional fields with constraints.
   *
   * @returns The schema instance (for chaining)
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
   * Adds a custom validation rule to the current field.
   *
   * Useful for business-specific logic that should not live
   * in the standard rules set.
   *
   * @param rule - Custom rule instance
   * @param options - Rule options
   * @returns The schema instance (for chaining)
   */
  public custom(rule: ValidationRule, options?: RuleOptions): this {
    this.addRule(rule, options);
    return this;
  }

  /**
   * Finalizes the schema build process.
   *
   * @returns The internal schema definition consumed by the validation engine
   */
  public build(): Map<string, FieldDefinition> {
    return this.fields;
  }

  private setOptional(optional: boolean): void {
    if (!this.currentField) throw new ValidatorFieldException();

    const field = this.fields.get(this.currentField);
    if (field) field.optional = optional;
  }

  private addRule(rule: ValidationRule, options?: RuleOptions): void {
    if (!this.currentField) throw new ValidatorFieldException();

    const field = this.fields.get(this.currentField);
    if (field) field.rules.push({ rule, options });
  }
}
