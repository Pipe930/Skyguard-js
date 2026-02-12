import { ValidationException } from "../exceptions/validationException";
import type {
  ValidationContext,
  ValidationError,
  ValidationResult,
  FieldDefinition,
} from "./types";

/**
 * Framework validation engine.
 *
 * Executes the rules defined in a schema against an input data object.
 * Schemas are typically built using {@link ValidationSchema}.
 */
export class Validator {
  /**
   * Validates input data against a schema.
   *
   * Behavior:
   * - Only fields defined in the schema are validated
   * - Optional fields are skipped if missing from the input
   * - Rules run in the order they were defined
   * - Fail-fast per field (stops at the first failing rule for that field)
   *
   * @param data - Input data to validate
   * @param schema - Validation schema definition
   * @returns Validation result:
   * - `valid`: whether the data passed validation
   * - `errors`: list of validation errors
   * - `data`: original data when validation succeeds
   *
   * @example
   * const schema = ValidationSchema.create()
   *   .field("email").required().string().email()
   *   .field("age").optional().number({ min: 18 })
   *   .build();
   *
   * const result = Validator.validate(
   *   { email: "a@b.com", age: 20 },
   *   schema
   * );
   *
   * if (!result.valid) {
   *   console.log(result.errors);
   * }
   */
  public static validate(
    data: Record<string, unknown>,
    schema: Map<string, FieldDefinition>,
  ): ValidationResult {
    const errors: ValidationError[] = [];

    for (const [fieldName, fieldDef] of schema.entries()) {
      const value = data[fieldName];

      const context: ValidationContext = {
        field: fieldName,
        value,
        data,
      };

      if (fieldDef.optional && value === undefined) continue;

      for (const { rule, options } of fieldDef.rules) {
        const error = rule.validate(context, options);

        if (error) {
          errors.push(error);
          break;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      data: errors.length === 0 ? data : undefined,
    };
  }

  /**
   * Validates input data and throws if any rule fails.
   *
   * @param data - Input data to validate
   * @param schema - Validation schema definition
   * @returns The original data when validation succeeds
   * @throws {ValidationException} When validation fails
   *
   * @example
   * const schema = ValidationSchema.create()
   *   .field("email").required().string().email()
   *   .build();
   *
   * const data = Validator.validateOrFail({ email: "a@b.com" }, schema);
   * // `data` is the original input when valid
   */
  public static validateOrFail(
    data: Record<string, unknown>,
    schema: Map<string, FieldDefinition>,
  ): unknown {
    const result = this.validate(data, schema);

    if (!result.valid) throw new ValidationException(result.errors);

    return result.data!;
  }
}
