import type { RuleOptions, ValidationContext, ValidationError } from "./types";

/**
 * Base contract for all framework validation rules.
 *
 * Each implementation represents an independent validation strategy
 * (Strategy Pattern).
 *
 * A rule must only evaluate the value and return an error when validation fails.
 */
export interface ValidationRule {
  /**
   * Executes the rule validation.
   *
   * Rules must not throw exceptions.
   *
   * @param context - Current validation context (field, value, full data)
   * @param options - Rule-specific options
   * @returns A {@link ValidationError} or `null` if the value is valid
   */
  validate(
    context: ValidationContext,
    options?: RuleOptions,
  ): ValidationError | null;
}

/**
 * Abstract base class for implementing validation rules.
 */
export abstract class BaseValidationRule<T = any> implements ValidationRule {
  public hasOptional = false;
  public defaultValue?: T = undefined;

  constructor(
    private readonly name: string,
    public readonly rules: Array<{
      rule: ValidationRule;
      options?: RuleOptions;
    }> = [],
  ) {}

  abstract validate(
    context: ValidationContext,
    options?: RuleOptions,
  ): ValidationError | null;

  /**
   * Marks the field as optional.
   *
   * @returns This rule instance for chaining
   */
  public optional(): this {
    this.hasOptional = true;
    return this;
  }

  public default(value: T): this {
    this.defaultValue = value;
    this.hasOptional = true;
    return this;
  }

  protected createError(
    field: string,
    message: string,
    value?: unknown,
  ): ValidationError {
    return {
      field,
      message,
      value,
      rule: this.name,
    };
  }
}
