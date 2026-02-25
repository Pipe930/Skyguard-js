import { BaseValidationRule } from "../validationRule";
import type { RuleOptions, ValidationContext, ValidationError } from "../types";

export interface StringRuleOptions extends RuleOptions {
  isEmpty?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
}

/**
 * String validation rule.
 *
 * Validates that a value is a string.
 */
export class StringRule extends BaseValidationRule {
  constructor() {
    super("string");
  }

  validate(
    context: ValidationContext,
    options?: StringRuleOptions,
  ): ValidationError | null {
    const { field, value } = context;

    if (typeof value !== "string")
      return this.createError(
        field,
        options?.message || `${field} must be a string`,
        value,
      );

    let str = value;

    if (options?.isEmpty && str === "")
      return this.createError(field, `${field} cannot be empty`, value);

    if (options?.minLength && str.length < options.minLength)
      return this.createError(
        field,
        `${field} must be at least ${options.minLength} characters`,
        value,
      );

    if (options?.maxLength && str.length > options.maxLength)
      return this.createError(
        field,
        `${field} must be at most ${options.maxLength} characters`,
        value,
      );

    if (options?.pattern && !options.pattern.test(str))
      return this.createError(
        field,
        options?.message || `${field} format is invalid`,
        value,
      );

    return null;
  }

  /**
   * Validates that the string is a valid email address.
   *
   * @param message - Optional custom error message
   * @returns This StringRule instance for chaining
   *
   * @example
   * validator.string().email()
   * validator.string().email("Invalid email format")
   */
  email(message?: string): this {
    this.rules.push({
      rule: new EmailRule(),
      options: { message },
    });
    return this;
  }

  /**
   * Validates that the string is a valid URL.
   *
   * @param message - Optional custom error message
   * @returns This StringRule instance for chaining
   *
   * @example
   * validator.string().url()
   * validator.string().url("Must be a valid URL")
   */
  url(message?: string): this {
    this.rules.push({
      rule: new UrlRule(),
      options: { message },
    });
    return this;
  }

  /**
   * Validates that the string is a valid UUID.
   *
   * @param message - Optional custom error message
   * @returns This StringRule instance for chaining
   *
   * @example
   * validator.string().uuid()
   */
  uuid(message?: string): this {
    this.rules.push({
      rule: new UuidRule(),
      options: { message },
    });
    return this;
  }
}

/**
 * Email validation rule.
 *
 * Validates that a value is a valid email address.
 */
export class EmailRule extends BaseValidationRule {
  private readonly emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  constructor() {
    super("email");
  }

  validate(
    context: ValidationContext,
    options?: RuleOptions,
  ): ValidationError | null {
    const { field, value } = context;

    if (!this.emailRegex.test(value as string))
      return this.createError(
        field,
        options?.message || `${field} must be a valid email`,
        value,
      );

    return null;
  }
}

/**
 * URL validation rule
 */
export class UrlRule extends BaseValidationRule {
  constructor() {
    super("url");
  }

  validate(
    context: ValidationContext,
    options?: RuleOptions,
  ): ValidationError | null {
    const { field, value } = context;

    try {
      new URL(value as string);
      return null;
    } catch {
      return this.createError(
        field,
        options?.message || `${field} must be a valid URL`,
        value,
      );
    }
  }
}

/**
 * UUID validation rule
 */
export class UuidRule extends BaseValidationRule {
  private readonly uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  constructor() {
    super("uuid");
  }

  validate(
    context: ValidationContext,
    options?: RuleOptions,
  ): ValidationError | null {
    const { field, value } = context;

    if (!this.uuidRegex.test(value as string)) {
      return this.createError(
        field,
        options?.message || `${field} must be a valid UUID`,
        value,
      );
    }

    return null;
  }
}
