import type { ValidationContext, RuleOptions, ValidationError } from "../types";
import { BaseValidationRule } from "../validationRule";

export interface ArrayRuleOptions extends RuleOptions {
  minLength?: number;
  maxLength?: number;
}

export class ArrayRule extends BaseValidationRule<Array<any>> {
  private readonly typeValid: BaseValidationRule;

  constructor(typeValid?: BaseValidationRule) {
    super("array");
    this.typeValid = typeValid;
  }

  validate(
    context: ValidationContext,
    options?: ArrayRuleOptions,
  ): ValidationError | null {
    const { field, value } = context;

    if (!Array.isArray(value)) {
      return this.createError(
        field,
        options?.message || `${field} must be an array`,
        value,
      );
    }

    if (options?.minLength && value.length < options.minLength) {
      return this.createError(
        field,
        `${field} must have at least ${options.minLength} items`,
        value,
      );
    }

    if (options?.maxLength && value.length > options.maxLength) {
      return this.createError(
        field,
        `${field} must have at most ${options.maxLength} items`,
        value,
      );
    }

    if (this.typeValid) {
      for (const key of value) {
        const error = this.typeValid.validate({
          field: "item list",
          value: key,
        });

        if (error) return error;
      }
    }

    return null;
  }
}
