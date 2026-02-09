import { BaseValidationRule } from "../validationRule";
import type { RuleOptions, ValidationContext, ValidationError } from "../types";

export interface StringRuleOptions extends RuleOptions {
  isEmpty?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  trim?: boolean;
}

/**
 * Regla que valida strings.
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

    if (options?.isEmpty !== undefined && !options.isEmpty && str === "")
      return this.createError(field, `${field} cannot be empty`, value);

    if (options?.trim) str = str.trim();

    if (options?.minLength !== undefined && str.length < options.minLength)
      return this.createError(
        field,
        `${field} must be at least ${options.minLength} characters`,
        value,
      );

    if (options?.maxLength !== undefined && str.length > options.maxLength)
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
}
