import type { ValidationContext, RuleOptions, ValidationError } from "../types";
import { BaseValidationRule } from "../validationRule";

export interface ArrayRuleOptions extends RuleOptions {
  minLength?: number;
  maxLength?: number;
}

export class ArrayRule extends BaseValidationRule {
  constructor() {
    super("array");
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

    return null;
  }

  public string(message?: string): this {
    this.rules.push({
      rule: new ArrayStringRule(),
      options: { message },
    });
    return this;
  }

  public number(message?: string): this {
    this.rules.push({
      rule: new ArrayNumberRule(),
      options: { message },
    });
    return this;
  }
}

class ArrayStringRule extends BaseValidationRule {
  constructor() {
    super("arrayString");
  }

  validate(
    context: ValidationContext,
    options?: ArrayRuleOptions,
  ): ValidationError | null {
    const { field, value } = context;

    for (let i = 0; i < (value as any[]).length; i++) {
      if (typeof value[i] !== "string") {
        return this.createError(
          field,
          options?.message || `${field} must be an array of strings`,
          value,
        );
      }
    }

    return null;
  }
}

export class ArrayNumberRule extends BaseValidationRule {
  constructor() {
    super("arrayNumber");
  }

  validate(
    context: ValidationContext,
    options?: ArrayRuleOptions,
  ): ValidationError | null {
    const { field, value } = context;

    for (let i = 0; i < (value as any[]).length; i++) {
      if (typeof value[i] !== "number") {
        return this.createError(
          field,
          options?.message || `${field} must be an array of numbers`,
          value,
        );
      }
    }

    return null;
  }
}
