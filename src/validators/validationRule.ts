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
  /**
   * Creates a new validation rule.
   *
   * @param name - Unique rule name
   */
  constructor(public readonly name: string) {}

  /**
   * Executes the rule validation.
   */
  abstract validate(
    context: ValidationContext,
    options?: RuleOptions,
  ): ValidationError | null;

  /**
   * Creates a standardized {@link ValidationError} object.
   *
   * Concrete rules should use this helper to ensure consistent
   * error shapes across the framework.
   *
   * @param field - Field name that failed validation
   * @param message - Human-readable error message
   * @param value - Invalid value (optional)
   * @returns A {@link ValidationError} instance
   */
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
