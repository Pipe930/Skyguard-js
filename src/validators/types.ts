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
  /** Indicates whether the validation passed */
  valid: boolean;

  /** List of validation errors */
  errors: ValidationError[];

  /** Optional validated data */
  data?: unknown;
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

  /** Full input data */
  data: unknown;
}
