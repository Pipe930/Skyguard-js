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

    const validValues = [true, false, "true", "false", 0, 1];

    if (!validValues.includes(value as any))
      return this.createError(
        field,
        options?.message || `${field} must be a boolean`,
        value,
      );

    return null;
  }
}
