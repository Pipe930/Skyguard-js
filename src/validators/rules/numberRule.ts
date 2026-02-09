import { BaseValidationRule } from "../validationRule";
import type { RuleOptions, ValidationContext, ValidationError } from "../types";

export interface NumberRuleOptions extends RuleOptions {
  min?: number;
  max?: number;
  integer?: boolean;
  positive?: boolean;
}

/**
 * Regla que valida números.
 */
export class NumberRule extends BaseValidationRule {
  constructor() {
    super("number");
  }

  validate(
    context: ValidationContext,
    options?: NumberRuleOptions,
  ): ValidationError | null {
    const { field, value } = context;
    const num = typeof value === "string" ? Number(value) : value;

    if (typeof num !== "number" || isNaN(num))
      return this.createError(
        field,
        options?.message || `${field} must be a number`,
        value,
      );

    if (options?.integer && !Number.isInteger(num))
      return this.createError(field, `${field} must be an integer`, value);

    if (options?.positive && num <= 0)
      return this.createError(field, `${field} must be positive`, value);

    if (options?.min && num < options.min)
      return this.createError(
        field,
        `${field} must be at least ${options.min}`,
        value,
      );

    if (options?.max && num > options.max)
      return this.createError(
        field,
        `${field} must be at most ${options.max}`,
        value,
      );

    return null;
  }
}
