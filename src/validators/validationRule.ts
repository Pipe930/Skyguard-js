import { RequiredRule } from "./rules";
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
   * Unique rule name.
   */
  readonly name: string;

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
export abstract class BaseValidationRule implements ValidationRule {
  public _optional = false;

  constructor(
    public readonly name: string,
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
   * Marks the field as required.
   *
   * @param message - Optional custom error message
   * @returns This rule instance for chaining
   */
  public required(message?: string): this {
    this._optional = false;
    this.rules.push({ rule: new RequiredRule(), options: { message } });
    return this;
  }

  /**
   * Marks the field as optional.
   *
   * @returns This rule instance for chaining
   */
  public optional(): this {
    this._optional = true;
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
