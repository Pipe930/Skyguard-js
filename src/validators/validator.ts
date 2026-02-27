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
   */
  public static validate(
    data: Record<string, unknown>,
    schema: Map<string, FieldDefinition>,
  ): ValidationResult {
    const errors: ValidationError[] = [];

    for (const [fieldName, fieldDef] of schema.entries()) {
      const context: ValidationContext = {
        field: fieldName,
        value: data[fieldName],
      };

      if (fieldDef.optional && data[fieldName] === undefined) continue;

      if (data[fieldName] === undefined || data[fieldName] === null) {
        errors.push({
          field: fieldName,
          message: `${fieldName} is required`,
          rule: "required",
        });
        continue;
      }

      for (const { rule, options } of fieldDef.rules) {
        const error = rule.validate(context, options);

        if (error) {
          errors.push(error);
          break;
        }
      }
    }

    return {
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
   */
  public static validateOrFail(
    data: Record<string, unknown>,
    schema: Map<string, FieldDefinition>,
  ): unknown {
    const result = this.validate(data, schema);

    if (result.errors.length !== 0)
      throw new ValidationException(result.errors);

    for (const [fieldName, fieldDef] of schema.entries()) {
      if (!(fieldName in result) && fieldDef.defaultValue !== undefined)
        result.data[fieldName] = fieldDef.defaultValue;
    }

    return result.data;
  }
}
