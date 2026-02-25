import { ValidationRule } from "./validationRule";

/**
 * Result of a single validation rule.
 */
export interface ValidationError {
  /** Field name that failed validation */
  field: string;

  /** Human-readable error message */
  message: string;

  /** Invalid value (if available) */
  value?: unknown;

  /** Validation rule identifier */
  rule: string;
}

/**
 * Full validation result.
 */
export interface ValidationResult {
  /** List of validation errors */
  errors: ValidationError[];

  /** Optional validated data */
  data: Record<string, unknown>;
}

/**
 * Options for a validation rule.
 */
export interface RuleOptions {
  /** Custom error message */
  message?: string;

  /** Rule-specific options */
  [key: string]: unknown;
}

/**
 * Validation execution context.
 */
export interface ValidationContext {
  /** Field name being validated */
  field: string;

  /** Field value */
  value: unknown;
}

/**
 * Field definition used by the validation engine.
 */
export interface FieldDefinition {
  rules: Array<{ rule: ValidationRule; options?: RuleOptions }>;
  optional: boolean;
  defaultValue?: unknown;
}
