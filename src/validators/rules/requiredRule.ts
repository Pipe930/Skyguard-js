import type { RuleOptions, ValidationContext, ValidationError } from "../types";
import { BaseValidationRule } from "../validationRule";

/**
 * Required field validation rule.
 *
 * Validates that a value is present and not empty.
 */
export class RequiredRule extends BaseValidationRule {
  constructor() {
    super("required");
  }

  validate(
    context: ValidationContext,
    options?: RuleOptions,
  ): ValidationError | null {
    const { field, value } = context;

    if (value === null || value === undefined)
      return this.createError(
        field,
        options?.message || `${field} is required`,
        value,
      );

    return null;
  }
}
