import { BaseValidationRule } from "../validationRule";
import type { RuleOptions, ValidationContext, ValidationError } from "../types";

export interface DateRuleOptions extends RuleOptions {
  min?: Date | string;
  max?: Date | string;
  format?: "iso" | "timestamp";
}

/**
 * Date validation rule.
 *
 * Validates that a value represents a valid date.
 */
export class DateRule extends BaseValidationRule {
  constructor() {
    super("date");
  }

  validate(
    context: ValidationContext,
    options?: DateRuleOptions,
  ): ValidationError | null {
    const { field, value } = context;
    let date: Date;

    if (value instanceof Date) {
      date = value;
    } else if (typeof value === "string" || typeof value === "number") {
      date = new Date(value);
    } else {
      return this.createError(field, `${field} must be a valid date`, value);
    }

    if (isNaN(date.getTime())) {
      return this.createError(
        field,
        options?.message || `${field} must be a valid date`,
        value,
      );
    }

    if (options?.min) {
      const minDate = new Date(options.min);
      if (date < minDate) {
        return this.createError(
          field,
          `${field} must be after ${minDate.toISOString()}`,
          value,
        );
      }
    }

    if (options?.max) {
      const maxDate = new Date(options.max);
      if (date > maxDate) {
        return this.createError(
          field,
          `${field} must be before ${maxDate.toISOString()}`,
          value,
        );
      }
    }

    return null;
  }
}
