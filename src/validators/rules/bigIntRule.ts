import type { ValidationContext, RuleOptions, ValidationError } from "../types";
import { BaseValidationRule } from "../validationRule";

export interface BigIntRuleOptions extends RuleOptions {
  gt?: bigint;
  gte?: bigint;
  lt?: bigint;
  lte?: bigint;
  positive?: boolean;
  negative?: boolean;
}

export class BigIntRule extends BaseValidationRule<bigint> {
  constructor() {
    super("bigint");
  }

  validate(
    context: ValidationContext,
    options?: BigIntRuleOptions,
  ): ValidationError | null {
    const { field, value } = context;

    if (typeof value !== "bigint") {
      return this.createError(
        field,
        options?.message || `${field} must be an bigint`,
        value,
      );
    }

    if (options?.positive && value <= 0n)
      return this.createError(field, `${field} must be positive`, value);

    if (options?.negative && value >= 0n)
      return this.createError(field, `${field} must be negative`, value);

    if (options?.gt && value <= options.gt)
      return this.createError(
        field,
        `${field} must be greater than ${options.gt}`,
        value,
      );

    if (options?.gte && value < options.gte)
      return this.createError(
        field,
        `${field} must be greater than or equal to ${options.gte}`,
        value,
      );

    if (options?.lt && value >= options.lt)
      return this.createError(
        field,
        `${field} must be less than ${options.lt}`,
        value,
      );

    if (options?.lte && value > options.lte)
      return this.createError(
        field,
        `${field} must be less than or equal to ${options.lte}`,
        value,
      );

    return null;
  }

  gt(limit: bigint, message?: string): this {
    this.rules.push({ rule: this, options: { gt: limit, message } });
    return this;
  }

  gte(limit: bigint, message?: string): this {
    this.rules.push({ rule: this, options: { gte: limit, message } });
    return this;
  }

  lt(limit: bigint, message?: string): this {
    this.rules.push({ rule: this, options: { lt: limit, message } });
    return this;
  }

  lte(limit: bigint, message?: string): this {
    this.rules.push({ rule: this, options: { lte: limit, message } });
    return this;
  }

  positive(message?: string): this {
    this.rules.push({ rule: this, options: { positive: true, message } });
    return this;
  }

  negative(message?: string): this {
    this.rules.push({ rule: this, options: { negative: true, message } });
    return this;
  }
}
