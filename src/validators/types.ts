import { BaseValidationRule, ValidationRule } from "./validationRule";

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

/**
 * Defines the validation rules for different parts of an incoming HTTP request.
 *
 * This schema allows specifying validation rules for:
 * - **body** → parsed request payload (e.g., JSON or form data)
 * - **params** → dynamic route parameters extracted from the URL
 * - **query** → query string parameters
 *
 * Each property maps field names to a `BaseValidationRule`, which encapsulates
 * the validation logic and constraints for that field.
 *
 * This interface represents the **developer-facing schema definition** before
 * any compilation or preprocessing occurs.
 *
 * Typical usage involves passing this schema to a validation layer that
 * transforms it into a more efficient internal representation
 * (`CompiledRequestValidationSchema`) for runtime execution.
 */
export interface RequestValidationSchema {
  body?: Record<string, BaseValidationRule>;
  params?: Record<string, BaseValidationRule>;
  query?: Record<string, BaseValidationRule>;
}

/**
 * Internal compiled representation of a `RequestValidationSchema`.
 *
 * During initialization, the raw schema provided by the developer is
 * transformed into this structure to improve runtime performance.
 *
 * Instead of plain objects, validation rules are stored in `Map` instances,
 * allowing faster lookups and preserving insertion order during validation.
 *
 * Each entry maps a field name to a `FieldDefinition`, which typically contains:
 * - the associated validation rule
 * - configuration options
 * - metadata required during validation
 *
 * This structure is intended for **internal validation engine use**
 * and is generally not exposed directly to application code.
 */
export interface CompiledRequestValidationSchema {
  body: Map<string, FieldDefinition>;
  params: Map<string, FieldDefinition>;
  query: Map<string, FieldDefinition>;
}
