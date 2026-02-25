import type { RuleOptions, ValidationContext, ValidationError } from "../types";
import { BaseValidationRule } from "../validationRule";

/**
 * Boolean validation rule.
 *
 * Validates that a value is a boolean (`true` or `false`).
 */
export class BooleanRule extends BaseValidationRule {
  constructor() {
    super("boolean");
  }

  validate(
    context: ValidationContext,
    options?: RuleOptions,
  ): ValidationError | null {
    const { field, value } = context;

    if (typeof value !== "boolean") {
      return this.createError(
        field,
        options?.message || `${field} must be a boolean`,
        value,
      );
    }

    return null;
  }
}
