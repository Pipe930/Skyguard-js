import { BaseValidationRule } from "../core/validationRule";
import type { RuleOptions, ValidationContext, ValidationError } from "../types";

/**
 * Regla que valida emails.
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

    if (typeof value !== "string")
      return this.createError(field, `${field} must be a string`, value);

    if (!this.emailRegex.test(value))
      return this.createError(
        field,
        options?.message || `${field} must be a valid email`,
        value,
      );

    return null;
  }
}
