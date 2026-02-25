import type { ValidationContext, RuleOptions, ValidationError } from "../types";
import { BaseValidationRule } from "../validationRule";

export interface ArrayRuleOptions extends RuleOptions {
  minLength?: number;
  maxLength?: number;
}

export class ArrayRule extends BaseValidationRule<Array<unknown>> {
  private readonly typeValid?: BaseValidationRule;

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

    if (!this.typeValid) return null;

    const itemRules = this.typeValid.rules.length
      ? this.typeValid.rules
      : [{ rule: this.typeValid, options: undefined }];

    for (const [index, item] of value.entries()) {
      for (const { rule, options: itemOptions } of itemRules) {
        const error = rule.validate(
          {
            field: `${field}[${index}]`,
            value: item,
          },
          itemOptions,
        );

        if (error) return error;
      }
    }

    return null;
  }
}
